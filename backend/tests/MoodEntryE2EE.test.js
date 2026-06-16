/**
 * Tests for the MoodEntry E2EE branching (Phase 1.3 step 7, ADR-0009).
 *
 * Covers: when entryData.is_e2ee_encrypted is true, MoodEntry.create
 * stores the notes column as-is (opaque ciphertext) WITHOUT calling
 * encrypt(); when an existing row is read back with is_e2ee_encrypted
 * true, MoodEntry returns the opaque blob WITHOUT calling decrypt().
 *
 * Mocks the db module + encryption utility so we can assert that:
 *   - encrypt() / decrypt() are NEVER invoked on the E2EE path
 *   - encrypt() / decrypt() ARE invoked on the legacy path (regression)
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

const mockEncrypt = jest.fn((s) => `enc(${s})`);
const mockDecrypt = jest.fn((s) => s.startsWith('enc(') ? s.slice(4, -1) : s);

jest.mock('../src/utils/encryption', () => ({
  encrypt: (s) => mockEncrypt(s),
  decrypt: (s) => mockDecrypt(s)
}));

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));
jest.mock('../src/services/cacheService', () => ({
  short: { delByUser: jest.fn() },
  long:  { delByUser: jest.fn() }
}));

const db = require('../src/config/database');
const MoodEntry = require('../src/models/MoodEntry');

beforeEach(() => {
  jest.clearAllMocks();
  mockEncrypt.mockImplementation((s) => `enc(${s})`);
  mockDecrypt.mockImplementation((s) => s.startsWith('enc(') ? s.slice(4, -1) : s);
});

// ─── E2EE path: encrypt / decrypt MUST NOT be called ────────────────────────
describe('MoodEntry.create — E2EE path', () => {
  test('stores opaque ciphertext as-is and does NOT call encrypt()', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'e1', user_id: 'u1',
        notes: 'OPAQUE_CIPHERTEXT_BLOB',
        is_encrypted: false,
        is_e2ee_encrypted: true
      }]
    });

    const result = await MoodEntry.create('u1', {
      moodScore: 5,
      notes: 'OPAQUE_CIPHERTEXT_BLOB',
      is_e2ee_encrypted: true
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(result.notes).toBe('OPAQUE_CIPHERTEXT_BLOB');
    expect(result.is_e2ee_encrypted).toBe(true);
    // Confirm the SQL got the new column with TRUE
    const call = db.query.mock.calls[0];
    const sql = call[0];
    const values = call[1];
    expect(sql).toMatch(/is_e2ee_encrypted/);
    // 14 values total (added is_e2ee_encrypted). Last value is the flag.
    expect(values[values.length - 1]).toBe(true);
    // 13th is the legacy is_encrypted flag — must be FALSE for E2EE
    expect(values[values.length - 2]).toBe(false);
    // 10th value is the notes column — must be the opaque blob, not encrypted
    expect(values[9]).toBe('OPAQUE_CIPHERTEXT_BLOB');
  });

  test('passes through opaque blob on read (no decrypt) for E2EE row', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'e1',
        notes: 'OPAQUE_BLOB',
        is_encrypted: false,
        is_e2ee_encrypted: true
      }]
    });

    const result = await MoodEntry.create('u1', {
      moodScore: 5,
      notes: 'OPAQUE_BLOB',
      is_e2ee_encrypted: true
    });

    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(result.notes).toBe('OPAQUE_BLOB');
  });

  test('handles null/empty notes correctly when E2EE flag is true', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'e1', notes: null,
        is_encrypted: false, is_e2ee_encrypted: false
      }]
    });

    await MoodEntry.create('u1', {
      moodScore: 5,
      notes: null,
      is_e2ee_encrypted: true
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    const values = db.query.mock.calls[0][1];
    // notes column → null
    expect(values[9]).toBeNull();
    // is_e2ee_encrypted → false (because notes is empty; flag clears)
    expect(values[values.length - 1]).toBe(false);
  });
});

// ─── Legacy path: existing behaviour must NOT regress ───────────────────────
describe('MoodEntry.create — legacy path (regression)', () => {
  test('encrypts plaintext notes when is_e2ee_encrypted is absent or false', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'e1', notes: 'enc(my plaintext)',
        is_encrypted: true, is_e2ee_encrypted: false
      }]
    });

    const result = await MoodEntry.create('u1', {
      moodScore: 5,
      notes: 'my plaintext'
      // no is_e2ee_encrypted flag
    });

    expect(mockEncrypt).toHaveBeenCalledWith('my plaintext');
    expect(mockDecrypt).toHaveBeenCalledWith('enc(my plaintext)');
    expect(result.notes).toBe('my plaintext'); // decrypted for the response
  });

  test('skips encrypt for null notes (legacy behaviour)', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'e1', notes: null,
        is_encrypted: false, is_e2ee_encrypted: false
      }]
    });
    await MoodEntry.create('u1', { moodScore: 5, notes: null });
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  test('explicit is_e2ee_encrypted=false behaves identically to absent flag', async () => {
    db.query.mockResolvedValue({
      rows: [{
        notes: 'enc(hi)', is_encrypted: true, is_e2ee_encrypted: false
      }]
    });
    await MoodEntry.create('u1', {
      moodScore: 5, notes: 'hi', is_e2ee_encrypted: false
    });
    expect(mockEncrypt).toHaveBeenCalledWith('hi');
  });
});

// ─── Update path E2EE branching ─────────────────────────────────────────────
describe('MoodEntry.update — E2EE branching', () => {
  test('stores opaque ciphertext as-is on notes update with E2EE flag', async () => {
    db.query.mockResolvedValue({
      rows: [{
        notes: 'NEW_OPAQUE_BLOB',
        is_encrypted: false, is_e2ee_encrypted: true
      }]
    });

    await MoodEntry.update('e1', 'u1', {
      notes: 'NEW_OPAQUE_BLOB',
      is_e2ee_encrypted: true
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockDecrypt).not.toHaveBeenCalled();
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/is_e2ee_encrypted = \$/);
  });

  test('falls back to legacy encrypt when E2EE flag absent (regression)', async () => {
    db.query.mockResolvedValue({
      rows: [{ notes: 'enc(updated text)', is_encrypted: true, is_e2ee_encrypted: false }]
    });
    await MoodEntry.update('e1', 'u1', { notes: 'updated text' });
    expect(mockEncrypt).toHaveBeenCalledWith('updated text');
  });

  test('does not call encrypt when payload only changes non-notes fields', async () => {
    db.query.mockResolvedValue({
      rows: [{ notes: null, is_encrypted: false, is_e2ee_encrypted: false }]
    });
    // model.allowedFields uses snake_case keys
    await MoodEntry.update('e1', 'u1', { mood_score: 8 });
    expect(mockEncrypt).not.toHaveBeenCalled();
  });
});

// ─── Read path: decrypt-or-passthrough ──────────────────────────────────────
describe('MoodEntry — read-path decryption gate', () => {
  test('legacy encrypted row → decrypt() called and plaintext returned', async () => {
    db.query.mockResolvedValue({
      rows: [{
        notes: 'enc(secret)',
        is_encrypted: true,
        is_e2ee_encrypted: false
      }]
    });
    const result = await MoodEntry.create('u1', { moodScore: 5, notes: 'secret' });
    expect(mockDecrypt).toHaveBeenCalledWith('enc(secret)');
    expect(result.notes).toBe('secret');
  });

  test('E2EE row → decrypt() NOT called; opaque blob returned to client', async () => {
    db.query.mockResolvedValue({
      rows: [{
        notes: 'OPAQUE_CIPHERTEXT',
        is_encrypted: false,
        is_e2ee_encrypted: true
      }]
    });
    const result = await MoodEntry.create('u1', {
      moodScore: 5, notes: 'OPAQUE_CIPHERTEXT', is_e2ee_encrypted: true
    });
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(result.notes).toBe('OPAQUE_CIPHERTEXT');
  });
});
