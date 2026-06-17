import React, { useState, useEffect } from 'react';
import { e2eeAPI } from '../services/api';
import { setupNewUser, cacheMasterKey } from '../services/keyManagement';

/**
 * SetUpEncryption — first-login prompt + 3-screen wizard for the
 * client-side-key E2EE design (ADR-0009 phase 1.3 v1 step 3/9).
 *
 * Rendered conditionally by Dashboard. On mount:
 *   - If the user previously dismissed the prompt (localStorage), render nothing
 *   - Else GET /api/e2ee/metadata; on 200 the user is already set up → render nothing
 *   - On 404, surface the intro modal with "Set up now" / "Maybe later"
 *
 * The wizard NEVER blocks any existing flow: it's a modal overlay the user
 * can dismiss at any phase, and dismissal is non-destructive (no state is
 * uploaded to the server until the user explicitly confirms the recovery
 * phrase).
 *
 * Per ADR-0009 locked-in decision #3: dismissible prompt on first login.
 */

const DISMISS_KEY = 'mindspace.e2eeSetupDismissed';

const SetUpEncryption = () => {
  // checking | hidden | intro | passphrase | recovery | submitting | success | error
  const [phase, setPhase] = useState('checking');

  // Passphrase entry
  const [passphrase, setPassphrase]               = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  // Result of setupNewUser (recoveryPhrase + uploadBundle + masterKey)
  const [setupResult, setSetupResult] = useState(null);

  // Recovery-phrase confirmation
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [revealedPhrase, setRevealedPhrase]       = useState(false);

  const [error, setError]     = useState(null);
  const [working, setWorking] = useState(false);

  // ─── Mount: decide whether to surface the prompt ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (localStorage.getItem(DISMISS_KEY)) {
        if (!cancelled) setPhase('hidden');
        return;
      }
      try {
        await e2eeAPI.getMetadata();
        // 2xx → user already set up E2EE; no prompt needed.
        if (!cancelled) {
          setPhase('hidden');
          // Snap localStorage so we skip the network round-trip on next mount
          localStorage.setItem(DISMISS_KEY, 'already-set-up');
        }
      } catch (e) {
        // 2026-06-17: api.js's response interceptor flattens rejections,
        // so the HTTP status now lives on e.status (preserved by the
        // interceptor since the same date). Previously we read
        // e.response.status, which was always undefined post-interceptor,
        // so the 404 branch never fired and the wizard never appeared.
        const status = e && e.status;
        if (status === 404) {
          // Not set up — surface the intro.
          if (!cancelled) setPhase('intro');
        } else {
          // Auth or network error: silently hide. We never want this
          // component to surface an error on a page it didn't gate.
          if (!cancelled) setPhase('hidden');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleDismiss = (permanent = true) => {
    if (permanent) localStorage.setItem(DISMISS_KEY, '1');
    setPhase('hidden');
  };

  const startSetup = () => {
    setError(null);
    setPhase('passphrase');
  };

  const submitPassphrase = async () => {
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('The two passphrases do not match.');
      return;
    }
    setError(null);
    setWorking(true);
    try {
      // Generate everything client-side (Argon2id may take 0.3-2 s)
      const result = await setupNewUser(passphrase);
      setSetupResult(result);
      // Wipe the passphrase out of state ASAP — we never need it again
      setPassphrase('');
      setConfirmPassphrase('');
      setPhase('recovery');
    } catch (e) {
      setError(e.message || 'Could not derive a key on this device.');
    } finally {
      setWorking(false);
    }
  };

  const finalizeSetup = async () => {
    if (!recoveryConfirmed) {
      setError('Please confirm that you have stored the recovery phrase before continuing.');
      return;
    }
    setError(null);
    setWorking(true);
    try {
      await e2eeAPI.setup(setupResult.uploadBundle);
      cacheMasterKey(setupResult.masterKey);
      // Don't keep the unwrapped result lying around
      setSetupResult({
        // Keep ONLY the recovery phrase for the success screen (one last reminder)
        recoveryPhrase: setupResult.recoveryPhrase
      });
      // Mark as set up so we never prompt again on this device
      localStorage.setItem(DISMISS_KEY, 'set-up');
      setPhase('success');
    } catch (e) {
      const msg = (e && e.response && e.response.data && e.response.data.message)
        || (e && e.message)
        || 'Could not save E2EE configuration to the server.';
      setError(msg);
    } finally {
      setWorking(false);
    }
  };

  const closeSuccess = () => {
    setSetupResult(null);
    setPhase('hidden');
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (phase === 'checking' || phase === 'hidden') return null;

  return (
    <div style={overlayStyle} role="dialog" aria-labelledby="e2ee-setup-title" aria-modal="true">
      <div style={modalStyle}>
        {phase === 'intro' && (
          <IntroScreen onStart={startSetup} onDismiss={() => handleDismiss(true)} />
        )}
        {phase === 'passphrase' && (
          <PassphraseScreen
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            confirmPassphrase={confirmPassphrase}
            setConfirmPassphrase={setConfirmPassphrase}
            onSubmit={submitPassphrase}
            onCancel={() => handleDismiss(false)}
            working={working}
            error={error}
          />
        )}
        {phase === 'recovery' && (
          <RecoveryScreen
            phrase={setupResult ? setupResult.recoveryPhrase : ''}
            revealed={revealedPhrase}
            setRevealed={setRevealedPhrase}
            confirmed={recoveryConfirmed}
            setConfirmed={setRecoveryConfirmed}
            onSubmit={finalizeSetup}
            onCancel={() => handleDismiss(false)}
            working={working}
            error={error}
          />
        )}
        {phase === 'success' && setupResult && (
          <SuccessScreen
            phrase={setupResult.recoveryPhrase}
            onClose={closeSuccess}
          />
        )}
      </div>
    </div>
  );
};

// ─── Sub-screens ────────────────────────────────────────────────────────────

const IntroScreen = ({ onStart, onDismiss }) => (
  <>
    <h2 id="e2ee-setup-title" style={titleStyle}>
      <span aria-hidden="true">🔐</span> Enable end-to-end encryption?
    </h2>
    <p style={bodyStyle}>
      You can encrypt your private notes with a key that is derived <strong>in your browser</strong> from a
      passphrase you choose. Once enabled, the server stores your notes as ciphertext it cannot read,
      even with full database access.
    </p>
    <p style={bodyStyle}>
      Setup takes about a minute and is opt-in. You can keep using Mindspace exactly as today and turn
      this on later from Settings.
    </p>
    <div style={warningBoxStyle}>
      <strong>⚠️ Important:</strong> If you forget your passphrase <em>and</em> lose the 12-word recovery
      phrase you will be shown next, your encrypted notes will be unrecoverable. Your account itself can
      still be reset via the standard password-reset flow, but old encrypted notes will stay unreadable.
    </div>
    <div style={buttonRowStyle}>
      <button type="button" className="btn btn-primary" onClick={onStart}>Set up now</button>
      <button type="button" className="btn" onClick={onDismiss} style={ghostButtonStyle}>Maybe later</button>
    </div>
  </>
);

const PassphraseScreen = ({
  passphrase, setPassphrase,
  confirmPassphrase, setConfirmPassphrase,
  onSubmit, onCancel, working, error
}) => {
  const strength = describeStrength(passphrase);
  return (
    <>
      <h2 id="e2ee-setup-title" style={titleStyle}>
        <span aria-hidden="true">🔑</span> Choose a passphrase
      </h2>
      <p style={bodyStyle}>
        Pick something you can remember but that is not your account password. A short phrase of 4-5
        unrelated words is much stronger than a single word with symbols. Minimum 8 characters.
      </p>
      <label style={labelStyle}>
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="new-password"
          style={inputStyle}
          disabled={working}
          minLength={8}
          aria-describedby="passphrase-strength"
        />
      </label>
      {passphrase && (
        <div id="passphrase-strength" style={{ ...bodyStyle, fontSize: '0.85em', marginTop: -6 }}>
          Strength: <strong style={{ color: strength.color }}>{strength.label}</strong>
        </div>
      )}
      <label style={labelStyle}>
        Confirm passphrase
        <input
          type="password"
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          autoComplete="new-password"
          style={inputStyle}
          disabled={working}
        />
      </label>
      {error && <div style={errorBoxStyle} role="alert">{error}</div>}
      <div style={buttonRowStyle}>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={working}>
          {working ? 'Deriving key on this device…' : 'Continue'}
        </button>
        <button type="button" className="btn" onClick={onCancel} style={ghostButtonStyle} disabled={working}>
          Cancel
        </button>
      </div>
    </>
  );
};

const RecoveryScreen = ({
  phrase, revealed, setRevealed, confirmed, setConfirmed,
  onSubmit, onCancel, working, error
}) => (
  <>
    <h2 id="e2ee-setup-title" style={titleStyle}>
      <span aria-hidden="true">🧷</span> Save your recovery phrase
    </h2>
    <p style={bodyStyle}>
      This 12-word phrase is the <strong>only way</strong> to recover your encrypted notes if you forget
      your passphrase. Write it down on paper, save it in a password manager, or both. We do NOT store
      this phrase on our servers.
    </p>
    <div style={phraseBoxStyle}>
      {revealed ? (
        <div style={phraseGridStyle}>
          {phrase.split(' ').map((word, i) => (
            <div key={i} style={phraseWordStyle}>
              <span style={phraseIndexStyle}>{i + 1}.</span> {word}
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          style={{ ...ghostButtonStyle, width: '100%' }}
        >
          👁️ Click to reveal your 12-word phrase
        </button>
      )}
    </div>
    {revealed && (
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16 }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={working}
          style={{ marginTop: 4 }}
        />
        <span>
          I have written down or saved my recovery phrase. I understand that losing it AND my passphrase
          means I lose access to my encrypted notes.
        </span>
      </label>
    )}
    {error && <div style={errorBoxStyle} role="alert">{error}</div>}
    <div style={buttonRowStyle}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onSubmit}
        disabled={working || !confirmed}
      >
        {working ? 'Finalising…' : 'Finish setup'}
      </button>
      <button type="button" className="btn" onClick={onCancel} style={ghostButtonStyle} disabled={working}>
        Cancel (discard setup)
      </button>
    </div>
  </>
);

const SuccessScreen = ({ phrase, onClose }) => (
  <>
    <h2 id="e2ee-setup-title" style={titleStyle}>
      <span aria-hidden="true">✓</span> End-to-end encryption is now active
    </h2>
    <p style={bodyStyle}>
      From this moment on, any note you write in this browser is encrypted with your master key before
      being sent to the server. The server stores only ciphertext.
    </p>
    <p style={bodyStyle}>
      One last reminder of your recovery phrase. Have you written it down?
    </p>
    <div style={phraseBoxStyle}>
      <div style={phraseGridStyle}>
        {phrase.split(' ').map((word, i) => (
          <div key={i} style={phraseWordStyle}>
            <span style={phraseIndexStyle}>{i + 1}.</span> {word}
          </div>
        ))}
      </div>
    </div>
    <div style={buttonRowStyle}>
      <button type="button" className="btn btn-primary" onClick={onClose}>
        I have saved it — close
      </button>
    </div>
  </>
);

// ─── Strength heuristic (display-only; the real strength is the KDF) ────────
function describeStrength(p) {
  if (!p) return { label: '—', color: 'var(--text-secondary)' };
  let score = 0;
  if (p.length >= 8)  score++;
  if (p.length >= 14) score++;
  if (p.length >= 20) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.includes(' ')) score++;  // bonus for passphrase-style spaces
  if (score <= 2) return { label: 'weak',     color: '#c53030' };
  if (score <= 4) return { label: 'moderate', color: '#d97706' };
  if (score <= 6) return { label: 'strong',   color: '#16a34a' };
  return { label: 'excellent', color: '#16a34a' };
}

// ─── Inline styles (match the rest of the app's pattern) ───────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
  padding: 'var(--spacing-md)',
};
const modalStyle = {
  background: 'var(--surface, #fff)', color: 'var(--text-primary, #2d3748)',
  borderRadius: 'var(--radius-lg, 8px)', padding: 'var(--spacing-xl)',
  maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
};
const titleStyle = {
  marginTop: 0, marginBottom: 'var(--spacing-md)',
  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: '1.4em',
};
const bodyStyle = { lineHeight: 1.55, marginBottom: 'var(--spacing-md)' };
const warningBoxStyle = {
  background: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7',
  padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md, 6px)',
  marginBottom: 'var(--spacing-lg)', fontSize: '0.92em', lineHeight: 1.5,
};
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
const buttonRowStyle = {
  display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap',
  marginTop: 'var(--spacing-lg)',
};
const ghostButtonStyle = { backgroundColor: 'var(--surface, #f5f5f7)' };
const phraseBoxStyle = {
  background: '#f7f9fc', border: '1px solid #d0d7de',
  borderRadius: 'var(--radius-md, 6px)', padding: 'var(--spacing-md)',
  marginTop: 'var(--spacing-md)',
};
const phraseGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8,
};
const phraseWordStyle = {
  display: 'flex', gap: 4, padding: '6px 8px',
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 'var(--radius-sm, 4px)', fontSize: '0.92em',
  fontFamily: 'Menlo, Consolas, monospace',
};
const phraseIndexStyle = { color: '#718096', fontSize: '0.85em', minWidth: 18 };

export default SetUpEncryption;
