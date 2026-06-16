import React, { useState, useEffect, useCallback } from 'react';
import { e2eeAPI, moodAPI } from '../services/api';
import { getCachedMasterKey } from '../services/keyManagement';
import { wrapForWrite } from '../services/moodEntryE2EE';

/**
 * UpgradeNotesToE2EE — Settings card that migrates a user's existing
 * server-encrypted mood-entry notes to client-side end-to-end encryption.
 *
 * Phase 1.3 v1 step 8/9 (2026-06-16) on top of ADR-0009.
 *
 * Conditions for surfacing:
 *   - user has completed E2EE setup (GET /api/e2ee/metadata → 200)
 * Conditions for the action being enabled:
 *   - master key cached this session (i.e. user is unlocked)
 *
 * Strategy:
 *   - Fetch entries that have notes (large limit; typical user has
 *     dozens not thousands). The server returns plaintext notes for any
 *     row where is_encrypted=true AND is_e2ee_encrypted=false (the legacy
 *     decrypt path on read)
 *   - For each entry with `notes && !is_e2ee_encrypted`, call
 *     `wrapForWrite(notes)` to re-encrypt locally and PUT to /api/mood/:id
 *     with the opaque blob and is_e2ee_encrypted=true. MoodEntry.update
 *     already stores opaque ciphertext as-is on that branch (covered by
 *     the 11 backend tests in MoodEntryE2EE.test.js)
 *   - Sequential with a small delay so we don't burst the API or flood
 *     the audit log with hundreds of concurrent writes. Per-entry failures
 *     are reported but don't halt the batch.
 *
 * After migration completes, the server CANNOT decrypt those notes;
 * the legacy ENCRYPTION_KEY secret stops mattering for that user's data.
 */

const REQUEST_DELAY_MS = 80;

const UpgradeNotesToE2EE = () => {
  // hidden | idle | confirming | running | done | error
  const [phase, setPhase] = useState('hidden');
  const [counts, setCounts] = useState({ legacy: 0, e2ee: 0, plain: 0 });
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [errorMsg, setErrorMsg] = useState(null);

  const refresh = useCallback(async () => {
    // Are we E2EE-enrolled?
    try {
      await e2eeAPI.getMetadata();
    } catch (e) {
      setPhase('hidden');
      return;
    }
    // Count the legacy / E2EE / plain split (only entries that HAVE notes)
    try {
      const res = await moodAPI.getAll({ limit: 1000 });
      const entries = (res.data && res.data.entries) || [];
      let legacy = 0, e2ee = 0, plain = 0;
      for (const e of entries) {
        if (!e.notes) continue;
        if (e.is_e2ee_encrypted)      e2ee   += 1;
        else if (e.is_encrypted)      legacy += 1;
        else                          plain  += 1;
      }
      setCounts({ legacy, e2ee, plain });
      setPhase('idle');
    } catch (e) {
      setErrorMsg('Could not load your entries to check migration status.');
      setPhase('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isUnlocked = Boolean(getCachedMasterKey());

  const runMigration = async () => {
    setPhase('running');
    setErrorMsg(null);
    setProgress({ done: 0, total: 0, failed: 0 });

    let total = 0, done = 0, failed = 0;
    try {
      const res = await moodAPI.getAll({ limit: 1000 });
      const entries = (res.data && res.data.entries) || [];
      // Migrate ONLY entries currently in the legacy server-encrypted state.
      // Skip plaintext rows (no notes column at all) and skip rows already
      // upgraded. is_e2ee_encrypted is the authoritative flag.
      const todo = entries.filter(e =>
        e.notes && e.is_encrypted && !e.is_e2ee_encrypted
      );
      total = todo.length;
      setProgress({ done: 0, total, failed: 0 });

      if (total === 0) {
        setPhase('done');
        return;
      }

      for (const entry of todo) {
        try {
          const { notes: opaque, is_e2ee_encrypted } = await wrapForWrite(entry.notes);
          if (!is_e2ee_encrypted) {
            // wrapForWrite gracefully returned plaintext (e.g. key not
            // cached). Treat as a failure for this row; carry on.
            failed += 1;
            setProgress({ done, total, failed });
            // eslint-disable-next-line no-await-in-loop
            await sleep(REQUEST_DELAY_MS);
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          await moodAPI.update(entry.entry_id, {
            notes: opaque,
            is_e2ee_encrypted: true
          });
          done += 1;
          setProgress({ done, total, failed });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[E2EE migration] entry failed', entry.entry_id, e);
          failed += 1;
          setProgress({ done, total, failed });
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(REQUEST_DELAY_MS);
      }

      setPhase('done');
      // Re-pull counts so the UI reflects the new state
      await refresh();
    } catch (e) {
      setErrorMsg('Migration could not start: ' + (e?.message || 'unknown error'));
      setPhase('error');
    }
  };

  if (phase === 'hidden') return null;

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>
        <span aria-hidden="true">🔑</span> Upgrade existing notes to end-to-end encryption
      </h3>

      {phase === 'idle' && (
        <IdleScreen
          counts={counts}
          isUnlocked={isUnlocked}
          onStart={() => setPhase('confirming')}
        />
      )}

      {phase === 'confirming' && (
        <ConfirmScreen
          counts={counts}
          onCancel={() => setPhase('idle')}
          onConfirm={runMigration}
        />
      )}

      {phase === 'running' && (
        <ProgressScreen progress={progress} />
      )}

      {phase === 'done' && (
        <DoneScreen progress={progress} counts={counts} />
      )}

      {phase === 'error' && (
        <ErrorScreen msg={errorMsg} onRetry={refresh} />
      )}
    </div>
  );
};

const IdleScreen = ({ counts, isUnlocked, onStart }) => (
  <>
    <p style={bodyStyle}>
      Your existing notes are protected with server-side AES-256 encryption: only the application
      operator can decrypt them, using a server-held key. Upgrading them to end-to-end encryption
      means even the operator can no longer read them. Only you, in your own browser, can.
    </p>
    <div style={countsRowStyle}>
      <Badge label="To upgrade"        value={counts.legacy} color="#dd6b20" />
      <Badge label="Already upgraded"  value={counts.e2ee}   color="#38a169" />
      {counts.plain > 0 && (
        <Badge label="Plaintext (rare)" value={counts.plain} color="#718096" />
      )}
    </div>
    {!isUnlocked && (
      <div style={hintStyle}>
        🔒 Please unlock your E2EE master key first (the Dashboard prompts you on each
        new session). Then come back to start the upgrade.
      </div>
    )}
    <div style={buttonRowStyle}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onStart}
        disabled={!isUnlocked || counts.legacy === 0}
      >
        {counts.legacy === 0 ? 'All notes already upgraded' : `Upgrade ${counts.legacy} note${counts.legacy === 1 ? '' : 's'}`}
      </button>
    </div>
  </>
);

const ConfirmScreen = ({ counts, onCancel, onConfirm }) => (
  <>
    <p style={bodyStyle}>
      About to upgrade <strong>{counts.legacy}</strong> existing notes. This will:
    </p>
    <ul style={ulStyle}>
      <li>Re-encrypt each note locally with your master key</li>
      <li>Replace the server copy with the opaque ciphertext</li>
      <li>Take roughly {Math.ceil(counts.legacy * 0.15)} second{Math.ceil(counts.legacy * 0.15) === 1 ? '' : 's'} (one request per note with throttling)</li>
    </ul>
    <p style={{ ...bodyStyle, fontSize: '0.9em' }}>
      After this completes the server can no longer decrypt them. If you ever lose both your
      passphrase AND your recovery phrase, the upgraded notes are permanently unreadable.
    </p>
    <div style={buttonRowStyle}>
      <button type="button" className="btn btn-primary" onClick={onConfirm}>
        Yes, upgrade my notes
      </button>
      <button type="button" className="btn" onClick={onCancel} style={ghostButtonStyle}>
        Cancel
      </button>
    </div>
  </>
);

const ProgressScreen = ({ progress }) => {
  const pct = progress.total === 0 ? 0 : Math.round(100 * progress.done / progress.total);
  return (
    <>
      <p style={bodyStyle}>
        Upgrading: <strong>{progress.done}</strong> of <strong>{progress.total}</strong> notes
        {progress.failed > 0 && (
          <> <span style={{ color: '#c53030' }}> ({progress.failed} failed)</span></>
        )}
      </p>
      <div style={progressBarOuterStyle}>
        <div style={{ ...progressBarInnerStyle, width: pct + '%' }} />
      </div>
      <small style={{ color: 'var(--text-secondary)' }}>{pct}% complete</small>
    </>
  );
};

const DoneScreen = ({ progress, counts }) => (
  <>
    <p style={{ ...bodyStyle, color: '#38a169', fontWeight: 600 }}>
      ✓ Upgrade complete. {progress.done} notes are now end-to-end encrypted.
      {progress.failed > 0 && (
        <> <span style={{ color: '#c53030' }}>{progress.failed} could not be upgraded; you can re-run later.</span></>
      )}
    </p>
    <div style={countsRowStyle}>
      <Badge label="Still legacy"     value={counts.legacy} color="#dd6b20" />
      <Badge label="End-to-end safe"  value={counts.e2ee}   color="#38a169" />
    </div>
  </>
);

const ErrorScreen = ({ msg, onRetry }) => (
  <>
    <p style={{ ...bodyStyle, color: '#c53030' }}>{msg}</p>
    <button type="button" className="btn" onClick={onRetry}>Try again</button>
  </>
);

const Badge = ({ label, value, color }) => (
  <div style={{
    display: 'inline-flex', flexDirection: 'column',
    alignItems: 'center', minWidth: 110, padding: '6px 12px',
    borderRadius: 8, border: '1px solid ' + color, color,
  }}>
    <span style={{ fontSize: '1.4em', fontWeight: 700 }}>{value}</span>
    <span style={{ fontSize: '0.8em' }}>{label}</span>
  </div>
);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Styles ──────────────────────────────────────────────────────────────────
const cardStyle = {
  marginBottom: 'var(--spacing-xl)',
  padding: 'var(--spacing-lg)',
  backgroundColor: 'var(--background, #fafafa)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border, #e2e8f0)',
};
const titleStyle = {
  marginBottom: 'var(--spacing-sm)',
  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
};
const bodyStyle = {
  color: 'var(--text-secondary)',
  marginBottom: 'var(--spacing-md)',
  lineHeight: 1.55,
};
const countsRowStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)',
  marginBottom: 'var(--spacing-md)',
};
const hintStyle = {
  marginBottom: 'var(--spacing-md)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--radius-md, 6px)',
  background: '#fff5e0', color: '#7b341e', fontSize: '0.9em',
};
const ulStyle = {
  color: 'var(--text-secondary)',
  marginLeft: 'var(--spacing-lg)',
  fontSize: 'var(--font-size-small)',
  marginBottom: 'var(--spacing-md)',
};
const buttonRowStyle = {
  display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap',
  marginTop: 'var(--spacing-md)',
};
const ghostButtonStyle = { backgroundColor: 'var(--surface, #f5f5f7)' };
const progressBarOuterStyle = {
  width: '100%', height: 10, background: 'var(--surface, #e2e8f0)',
  borderRadius: 5, overflow: 'hidden', marginBottom: 6,
};
const progressBarInnerStyle = {
  height: '100%', background: '#38a169',
  transition: 'width 200ms ease-out',
};

export default UpgradeNotesToE2EE;
