/**
 * Tests for the JournalEntry model — E2EE branching mirrors the
 * MoodEntry tests shipped in commit 60641e2.
 *
 * Covers: when is_e2ee_encrypted=true the model stores opaque
 * ciphertext and never calls encrypt/decrypt; when false (or absent)
 * the legacy server-side path runs as before.
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

const mockEncrypt = jest.fn((s) => `enc(${s})`);
const mockDecrypt = jest.fn((s) => (s && s.startsWith('enc(') ? s.slice(4, -1) : s));

jest.mock('../src/utils/encryption', () => ({
  encrypt: (s) => mockEncrypt(s),
  decrypt: (s) => mockDecrypt(s),
}));

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const JournalEntry = require('../src/models/JournalEntry');

beforeEach(() => {
  jest.clearAllMocks();
  mockEncrypt.mockImplementation((s) => `enc(${s})`);
  mockDecrypt.mockImplementation((s) => (s && s.startsWith('enc(') ? s.slice(4, -1) : s));
});

describe('JournalEntry.create — E2EE path', () => {
  test('stores opaque ciphertext and does NOT call encrypt()', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'j1',
        prompt_id: 'gratitude',
        prompt_text: 'What are three things…',
        response: 'OPAQUE_RESPONSE',
        follow_up_responses: 'OPAQUE_FOLLOWUPS',
        mood_before: 5,
        mood_after: 7,
        is_encrypted: false,
        is_e2ee_encrypted: true,
      }],
    });
    const result = await JournalEntry.create('u1', {
      promptId: 'gratitude',
      promptText: 'What are three things…',
      response: 'OPAQUE_RESPONSE',
      followUpResponses: 'OPAQUE_FOLLOWUPS',
      moodBefore: 5,
      moodAfter: 7,
      is_e2ee_encrypted: true,
    });
    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(result.response).toBe('OPAQUE_RESPONSE');
    expect(result.is_e2ee_encrypted).toBe(true);
    const values = db.query.mock.calls[0][1];
    // is_encrypted (legacy) MUST be false on the E2EE path
    expect(values[7]).toBe(false);
    expect(values[8]).toBe(true);
  });

  test('null text + E2EE flag clears the flag (no point flagging an empty row)', async () => {
    db.query.mockResolvedValue({
      rows: [{ entry_id: 'j1', is_encrypted: false, is_e2ee_encrypted: false }],
    });
    await JournalEntry.create('u1', {
      promptId: 'gratitude',
      promptText: 'p',
      response: null,
      followUpResponses: null,
      is_e2ee_encrypted: true,
    });
    expect(mockEncrypt).not.toHaveBeenCalled();
    const values = db.query.mock.calls[0][1];
    expect(values[7]).toBe(false); // is_encrypted
    expect(values[8]).toBe(false); // is_e2ee_encrypted forced false (no payload)
  });
});

describe('JournalEntry.create — legacy server-side encrypt path', () => {
  test('encrypts both response and followUpResponses when E2EE flag absent', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'j1',
        response: 'enc(my reflection)',
        follow_up_responses: 'enc(["a","b"])',
        is_encrypted: true,
        is_e2ee_encrypted: false,
      }],
    });
    const result = await JournalEntry.create('u1', {
      promptId: 'gratitude',
      promptText: 'p',
      response: 'my reflection',
      followUpResponses: '["a","b"]',
    });
    expect(mockEncrypt).toHaveBeenCalledWith('my reflection');
    expect(mockEncrypt).toHaveBeenCalledWith('["a","b"]');
    // Response returned to controller IS decrypted (mirrors MoodEntry shape)
    expect(result.response).toBe('my reflection');
    expect(result.follow_up_responses).toBe('["a","b"]');
  });

  test('null payload skips encrypt entirely', async () => {
    db.query.mockResolvedValue({
      rows: [{ entry_id: 'j1', is_encrypted: false, is_e2ee_encrypted: false }],
    });
    await JournalEntry.create('u1', {
      promptId: 'gratitude', promptText: 'p', response: null, followUpResponses: null,
    });
    expect(mockEncrypt).not.toHaveBeenCalled();
  });
});

describe('JournalEntry.getUserEntries — read-path decrypt gate', () => {
  test('legacy row → decrypts response + follow_ups', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'j1',
        response: 'enc(plain)',
        follow_up_responses: 'enc(["x"])',
        is_encrypted: true,
        is_e2ee_encrypted: false,
      }],
    });
    const rows = await JournalEntry.getUserEntries('u1');
    expect(mockDecrypt).toHaveBeenCalledWith('enc(plain)');
    expect(mockDecrypt).toHaveBeenCalledWith('enc(["x"])');
    expect(rows[0].response).toBe('plain');
    expect(rows[0].follow_up_responses).toBe('["x"]');
  });

  test('E2EE row → opaque blob passes through without decrypt', async () => {
    db.query.mockResolvedValue({
      rows: [{
        entry_id: 'j1',
        response: 'OPAQUE',
        follow_up_responses: 'OPAQUE2',
        is_encrypted: false,
        is_e2ee_encrypted: true,
      }],
    });
    const rows = await JournalEntry.getUserEntries('u1');
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(rows[0].response).toBe('OPAQUE');
    expect(rows[0].follow_up_responses).toBe('OPAQUE2');
  });
});

describe('JournalEntry.deleteOne', () => {
  test('deletes when row exists', async () => {
    db.query.mockResolvedValue({ rowCount: 1 });
    const result = await JournalEntry.deleteOne('j1', 'u1');
    expect(result).toBe(true);
  });
  test('returns false when no row matches', async () => {
    db.query.mockResolvedValue({ rowCount: 0 });
    const result = await JournalEntry.deleteOne('j999', 'u1');
    expect(result).toBe(false);
  });
});
