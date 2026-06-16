import React, { useState, useEffect } from 'react';
import { e2eeAPI } from '../services/api';
import {
  unlockWithPassphrase, unlockWithRecoveryPhrase,
  cacheMasterKey, getCachedMasterKey
} from '../services/keyManagement';

/**
 * UnlockEncryption — passphrase / recovery-phrase modal for existing
 * E2EE-enrolled users to unlock their master key on a fresh session
 * (ADR-0009 phase 1.3 v1 step 4/9).
 *
 * Companion to SetUpEncryption (step 3). The two render in different
 * states:
 *   SetUpEncryption surfaces when GET /api/e2ee/metadata → 404 (not yet set up)
 *   UnlockEncryption surfaces when GET /api/e2ee/metadata → 200 (set up,
 *     but master key not in memory because session is fresh)
 *
 * "Skip for now" uses sessionStorage, not localStorage — closing the
 * tab and re-opening prompts again, so the user can't permanently silence
 * unlock-on-login by accident. A permanent silence is intentional v2+
 * scope (it would require "turn off E2EE" which the design rules out).
 *
 * Optional UX: if the user dismisses, new writes will continue to use
 * the legacy server-encrypted path (step 5/7 enforces that branching).
 * The modal makes that trade-off explicit so the user knows what they
 * are forgoing.
 */

const SESSION_SKIP_KEY = 'mindspace.e2eeUnlockSkippedThisSession';

const UnlockEncryption = () => {
  // checking | hidden | passphrase | recovery | submitting | success | error
  const [phase, setPhase] = useState('checking');
  const [metadata, setMetadata] = useState(null);

  // Inputs
  const [passphrase, setPassphrase]         = useState('');
  const [recoveryInput, setRecoveryInput]   = useState('');
  const [mode, setMode]                     = useState('passphrase'); // passphrase | recovery
  const [error, setError]                   = useState(null);
  const [working, setWorking]               = useState(false);

  // ─── Mount: decide whether to surface the prompt ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Already unlocked this session → nothing to do
      if (getCachedMasterKey()) {
        if (!cancelled) setPhase('hidden');
        return;
      }
      // User skipped earlier this tab session → respect it
      if (sessionStorage.getItem(SESSION_SKIP_KEY)) {
        if (!cancelled) setPhase('hidden');
        return;
      }
      try {
        const res = await e2eeAPI.getMetadata();
        // 2xx → user is enrolled; surface the unlock prompt
        if (!cancelled) {
          setMetadata(res.data && res.data.data ? res.data.data : res.data);
          setPhase('passphrase');
        }
      } catch (e) {
        // 404 → user has not set up E2EE (SetUpEncryption handles that)
        // 401 / network → silently hide (we never want this modal to gate
        // anything; an auth issue belongs elsewhere)
        if (!cancelled) setPhase('hidden');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSkip = () => {
    sessionStorage.setItem(SESSION_SKIP_KEY, '1');
    setPhase('hidden');
  };

  const handleUnlock = async () => {
    setError(null);
    if (mode === 'passphrase' && passphrase.length === 0) {
      setError('Please enter your passphrase.');
      return;
    }
    if (mode === 'recovery' && recoveryInput.trim().length === 0) {
      setError('Please paste or type your 12-word recovery phrase.');
      return;
    }
    setWorking(true);
    try {
      const masterKey = mode === 'passphrase'
        ? await unlockWithPassphrase(passphrase, metadata)
        : await unlockWithRecoveryPhrase(recoveryInput, metadata);
      cacheMasterKey(masterKey);
      // Wipe sensitive inputs from React state ASAP
      setPassphrase('');
      setRecoveryInput('');
      setPhase('success');
      // Auto-close after a beat
      setTimeout(() => setPhase('hidden'), 1200);
    } catch (e) {
      // unlockWithPassphrase throws on AES-GCM tag mismatch (= wrong key)
      // unlockWithRecoveryPhrase throws on bad checksum OR tag mismatch
      const msg = (e && e.message) || 'Could not unlock with the provided input.';
      // Don't echo the technical error; give a user-friendly summary
      if (/checksum|invalid/.test(msg)) {
        setError('That recovery phrase does not look right. Check for typos in any word.');
      } else if (mode === 'passphrase') {
        setError('Passphrase did not match. Please try again, or use your recovery phrase if you have forgotten the passphrase.');
      } else {
        setError('Recovery phrase did not unlock your data. Check it word-by-word.');
      }
    } finally {
      setWorking(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (phase === 'checking' || phase === 'hidden') return null;

  return (
    <div style={overlayStyle} role="dialog" aria-labelledby="e2ee-unlock-title" aria-modal="true">
      <div style={modalStyle}>
        {phase === 'success' ? (
          <SuccessScreen />
        ) : (
          <UnlockScreen
            mode={mode}
            setMode={setMode}
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            recoveryInput={recoveryInput}
            setRecoveryInput={setRecoveryInput}
            onUnlock={handleUnlock}
            onSkip={handleSkip}
            working={working}
            error={error}
          />
        )}
      </div>
    </div>
  );
};

const UnlockScreen = ({
  mode, setMode,
  passphrase, setPassphrase,
  recoveryInput, setRecoveryInput,
  onUnlock, onSkip, working, error
}) => (
  <>
    <h2 id="e2ee-unlock-title" style={titleStyle}>
      <span aria-hidden="true">🔓</span> Unlock your encrypted notes
    </h2>
    <p style={bodyStyle}>
      You have end-to-end encryption set up on this account. Enter your passphrase to derive your
      master key in this browser. The key stays in memory only for this tab; closing the tab clears it.
    </p>

    {mode === 'passphrase' ? (
      <label style={labelStyle}>
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="current-password"
          autoFocus
          style={inputStyle}
          disabled={working}
          onKeyDown={(e) => { if (e.key === 'Enter') onUnlock(); }}
        />
      </label>
    ) : (
      <label style={labelStyle}>
        Recovery phrase (12 words, space-separated)
        <textarea
          value={recoveryInput}
          onChange={(e) => setRecoveryInput(e.target.value)}
          rows={3}
          autoFocus
          style={{ ...inputStyle, fontFamily: 'Menlo, Consolas, monospace', resize: 'vertical' }}
          disabled={working}
          placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
        />
      </label>
    )}

    {error && <div style={errorBoxStyle} role="alert">{error}</div>}

    <div style={modeToggleStyle}>
      <button
        type="button"
        onClick={() => { setMode(mode === 'passphrase' ? 'recovery' : 'passphrase'); }}
        style={linkButtonStyle}
        disabled={working}
      >
        {mode === 'passphrase'
          ? 'Forgot your passphrase? Use your recovery phrase instead.'
          : '← Use passphrase instead'}
      </button>
    </div>

    <div style={buttonRowStyle}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onUnlock}
        disabled={working}
      >
        {working
          ? (mode === 'passphrase' ? 'Deriving key…' : 'Recovering key…')
          : 'Unlock'}
      </button>
      <button
        type="button"
        className="btn"
        onClick={onSkip}
        disabled={working}
        style={ghostButtonStyle}
        title="Continue without unlocking. Any notes you write this session will use the legacy server-encrypted path. Next login will prompt again."
      >
        Skip for now
      </button>
    </div>
  </>
);

const SuccessScreen = () => (
  <>
    <h2 id="e2ee-unlock-title" style={titleStyle}>
      <span aria-hidden="true">✓</span> Unlocked
    </h2>
    <p style={bodyStyle}>Your master key is in memory for this tab. Closing the tab clears it.</p>
  </>
);

// ─── Inline styles (mirror SetUpEncryption for visual consistency) ──────────
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
  padding: 'var(--spacing-md)',
};
const modalStyle = {
  background: 'var(--surface, #fff)', color: 'var(--text-primary, #2d3748)',
  borderRadius: 'var(--radius-lg, 8px)', padding: 'var(--spacing-xl)',
  maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
};
const titleStyle = {
  marginTop: 0, marginBottom: 'var(--spacing-md)',
  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: '1.4em',
};
const bodyStyle = { lineHeight: 1.55, marginBottom: 'var(--spacing-md)' };
const errorBoxStyle = {
  background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb',
  padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md, 6px)',
  marginTop: 'var(--spacing-md)', fontSize: '0.92em',
};
const labelStyle = {
  display: 'block', marginBottom: 'var(--spacing-md)',
  fontWeight: 500, fontSize: '0.95em',
};
const inputStyle = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '8px 12px', borderRadius: 'var(--radius-md, 6px)',
  border: '1px solid var(--border, #cbd5e0)', fontSize: '1em', fontFamily: 'inherit',
  background: 'var(--background, #fff)',
};
const modeToggleStyle = { marginTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' };
const linkButtonStyle = {
  background: 'none', border: 'none', color: 'var(--primary-color, #3366cc)',
  cursor: 'pointer', fontSize: '0.9em', padding: 0, textDecoration: 'underline',
};
const buttonRowStyle = {
  display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap',
  marginTop: 'var(--spacing-lg)',
};
const ghostButtonStyle = { backgroundColor: 'var(--surface, #f5f5f7)' };

export default UnlockEncryption;
