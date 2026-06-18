import React from 'react';
import { evaluatePassword } from '../utils/passwordStrength';

/**
 * PasswordStrengthMeter — shared live tier indicator (too-short / common /
 * weak / OK / strong / very strong) rendered under any password field.
 *
 * Extracted 2026-06-18 (S2) from Register.jsx so the new in-app password
 * change form in Settings can use the same control. Behaviour is identical
 * to the previous inline component: bar colour + label + optional hint,
 * renders nothing for empty input, aria-live so screen-reader users hear
 * tier changes as they type.
 *
 * Strength logic lives in utils/passwordStrength.js (NIST 800-63B aligned).
 */
const PasswordStrengthMeter = ({ password }) => {
  const { tier, label, bars, hint } = evaluatePassword(password);
  if (tier === 'empty') return null;

  const color =
    tier === 'too-short' || tier === 'common' || tier === 'weak' ? '#c53030' :
    tier === 'medium'      ? '#dd6b20' :
    tier === 'strong'      ? '#38a169' :
    tier === 'very-strong' ? '#22543d' :
    '#718096';

  const segmentBase = {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: 'var(--border, #e2e8f0)'
  };

  return (
    <div style={{ marginTop: 'var(--spacing-xs)' }} aria-live="polite">
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            style={{ ...segmentBase, background: n <= bars ? color : segmentBase.background }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82em' }}>
        <span style={{ color, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ color: 'var(--text-secondary)' }}>{hint}</span>}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
