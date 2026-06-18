import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { evaluatePassword } from '../utils/passwordStrength';
import PasswordStrengthMeter from './PasswordStrengthMeter';

/**
 * ChangePasswordForm — S2 (2026-06-18).
 *
 * Lets a signed-in user change their account password from inside the app.
 * Previously, only profile fields (username / user group) were editable
 * post-registration; password rotation required a full account reset.
 *
 * Behaviour mirrors registration:
 *   - Length floor (8) + common-password blocklist, enforced both client
 *     (`evaluatePassword`) and server (express-validator + isCommonPassword).
 *   - The new password must differ from the current one (server-enforced).
 *   - Confirm-new-password client-side typo guard.
 *   - Show/hide toggle on each field.
 *   - On success, clears all three fields and surfaces a confirmation.
 *
 * NOT a sign-out trigger: the existing JWT remains valid for its TTL by
 * design. Active session is the user's; revoking it on the same device
 * would be hostile UX. A future "sign out other devices" affordance is
 * a separate, deliberate feature.
 */
const ChangePasswordForm = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    const strength = evaluatePassword(newPassword);
    if (strength.blocking) {
      setError(
        strength.tier === 'too-short'
          ? 'New password must be at least 8 characters.'
          : 'This password is too common — please choose a less guessable one.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Your new password cannot be the same as your current password.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      setSuccess('Password updated. Use the new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const status = err?.status;
      if (status === 401) {
        setError('Current password is incorrect.');
      } else if (status === 400) {
        setError(err?.message || 'That password is not allowed. Please try a different one.');
      } else {
        setError('We could not update your password. Please try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (label, value, setter, show, setShow, autocomplete, id) => (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={(e) => setter(e.target.value)}
          autoComplete={autocomplete}
          style={{ paddingRight: 60 }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85em',
            padding: '4px 8px'
          }}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
      <h2 style={{ marginBottom: 'var(--spacing-sm)' }}>Change Password</h2>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: 'var(--spacing-lg)',
        fontSize: '0.92em'
      }}>
        Use a long passphrase you have not used elsewhere. Length matters more than
        symbols: <em>purple eagle 2026</em> is stronger than <em>P@55w0rd!</em>.
      </p>

      <form onSubmit={handleSubmit}>
        {renderField('Current password', currentPassword, setCurrentPassword,
                     showCurrent, setShowCurrent, 'current-password', 'currentPassword')}
        {renderField('New password', newPassword, setNewPassword,
                     showNew, setShowNew, 'new-password', 'newPassword')}
        <PasswordStrengthMeter password={newPassword} />
        {renderField('Confirm new password', confirmPassword, setConfirmPassword,
                     showConfirm, setShowConfirm, 'new-password', 'confirmPassword')}

        {error && (
          <div role="alert" style={{
            background: 'rgba(197, 48, 48, 0.10)',
            color: '#742a2a',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--spacing-md)',
            fontSize: '0.92em'
          }}>{error}</div>
        )}
        {success && (
          <div role="status" style={{
            background: 'rgba(56, 161, 105, 0.10)',
            color: '#1f5132',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--spacing-md)',
            fontSize: '0.92em'
          }}>{success}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
          style={{ marginTop: 'var(--spacing-md)' }}
        >
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordForm;
