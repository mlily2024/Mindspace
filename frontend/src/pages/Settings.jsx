import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import PrivacyNutritionLabel from '../components/PrivacyNutritionLabel';
import AuditLogVerification from '../components/AuditLogVerification';
import UpgradeNotesToE2EE from '../components/UpgradeNotesToE2EE';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import pushService from '../services/pushService';

// localStorage key for the user's on-device sentiment opt-in. Single source
// of truth — read by Settings (toggle) and MoodTracker (gate the analysis).
// Kept here (not in sentimentService) so importing the key does not drag the
// ~700 KB Transformers.js dependency into every consuming bundle.
export const SENTIMENT_OPT_IN_KEY = 'mindspace.onDeviceSentiment';

const Settings = () => {
  const { user, updateProfile, updatePreferences } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    userGroup: user?.user_group || 'other'
  });
  const [preferences, setPreferences] = useState({
    theme: user?.theme || 'light',
    fontSize: user?.font_size || 'medium',
    accessibilityMode: user?.accessibility_mode || false,
    notificationsEnabled: user?.notifications_enabled !== false
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');

    const result = await updateProfile(profileData);

    if (result.success) {
      setSuccess('Profile updated successfully');
    } else {
      alert('Failed to update profile');
    }

    setLoading(false);
  };

  const handlePreferencesUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');

    const result = await updatePreferences(preferences);

    if (result.success) {
      setSuccess('Preferences updated successfully');
      // Apply font size immediately
      document.body.className = `font-${preferences.fontSize}`;
      // Apply theme
      document.documentElement.setAttribute('data-theme', preferences.theme);
    } else {
      alert('Failed to update preferences');
    }

    setLoading(false);
  };

  return (
    <>
      <Navigation />
      <main id="main-content" className="container" style={{ maxWidth: '900px', paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>
        <h1 style={{ marginBottom: 'var(--spacing-xl)' }}>Settings</h1>

        {success && (
          <div className="alert alert-success" role="alert" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)', borderBottom: '2px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: 'var(--spacing-md)',
              border: 'none',
              background: 'none',
              color: activeTab === 'profile' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary-color)' : 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 500
            }}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            style={{
              padding: 'var(--spacing-md)',
              border: 'none',
              background: 'none',
              color: activeTab === 'preferences' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'preferences' ? '2px solid var(--primary-color)' : 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 500
            }}
          >
            Preferences
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: 'var(--spacing-md)',
              border: 'none',
              background: 'none',
              color: activeTab === 'privacy' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'privacy' ? '2px solid var(--primary-color)' : 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 500
            }}
          >
            Privacy
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="card">
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Profile Information</h2>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className="form-input"
                  value={user?.email || ''}
                  disabled
                  style={{ backgroundColor: 'var(--surface)' }}
                />
                <small style={{ color: 'var(--text-secondary)' }}>Email cannot be changed</small>
              </div>

              <div className="form-group">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                  type="text"
                  id="username"
                  className="form-input"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="userGroup" className="form-label">User Group</label>
                <select
                  id="userGroup"
                  className="form-select"
                  value={profileData.userGroup}
                  onChange={(e) => setProfileData({ ...profileData, userGroup: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="professional">Working Professional</option>
                  <option value="parent">Parent/Caregiver</option>
                  <option value="elderly">Older Adult</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="card">
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Accessibility & Display</h2>
            <form onSubmit={handlePreferencesUpdate}>
              <div className="form-group">
                <label htmlFor="theme" className="form-label">Theme</label>
                <select
                  id="theme"
                  className="form-select"
                  value={preferences.theme}
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="fontSize" className="form-label">Font Size</label>
                <select
                  id="fontSize"
                  className="form-select"
                  value={preferences.fontSize}
                  onChange={(e) => setPreferences({ ...preferences, fontSize: e.target.value })}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </select>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Larger text improves readability, especially for older adults
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.accessibilityMode}
                    onChange={(e) => setPreferences({ ...preferences, accessibilityMode: e.target.checked })}
                    style={{ minWidth: '20px', minHeight: '20px' }}
                  />
                  <span>Enable accessibility mode</span>
                </label>
                <small style={{ color: 'var(--text-secondary)', marginLeft: '28px' }}>
                  Enhanced contrast and simplified interface
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.notificationsEnabled}
                    onChange={(e) => setPreferences({ ...preferences, notificationsEnabled: e.target.checked })}
                    style={{ minWidth: '20px', minHeight: '20px' }}
                  />
                  <span>Enable notifications</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>

            <PushNotificationToggle />
          </div>
        )}

        {activeTab === 'privacy' && (
          <PrivacySettings user={user} setSuccess={setSuccess} />
        )}
      </main>
    </>
  );
};

// Push notifications opt-in (Stage E)
// Lives at the bottom of the Preferences tab — separate from the server-side
// notificationsEnabled preference above (that's for in-app/email; this is
// for OS-level browser push when the tab is closed).
const PushNotificationToggle = () => {
  const [status, setStatus]   = useState('loading'); // loading | unsupported | denied | enabled | disabled
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushService.isSupported()) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      const perm = pushService.getStatus();
      if (perm === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      const sub = await pushService.getSubscription();
      if (!cancelled) setStatus(sub ? 'enabled' : 'disabled');
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');
    const result = await pushService.enable();
    setBusy(false);
    if (result.ok) {
      setStatus('enabled');
      setMessage('Push notifications enabled — you will now receive OS notifications when the tab is closed.');
    } else {
      setMessage(result.error || 'Could not enable push notifications.');
      // Re-check status (the permission may now be 'denied' after the prompt).
      if (pushService.getStatus() === 'denied') setStatus('denied');
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage('');
    const result = await pushService.disable();
    setBusy(false);
    if (result.ok) {
      setStatus('disabled');
      setMessage('Push notifications disabled for this browser.');
    } else {
      setMessage(result.error || 'Could not disable push notifications.');
    }
  };

  const isError = message && /could not|fail|denied|not granted/i.test(message);

  return (
    <div
      style={{
        marginTop: 'var(--spacing-xl)',
        paddingTop: 'var(--spacing-lg)',
        borderTop: '1px solid var(--border)'
      }}
    >
      <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span>🔔</span> Push notifications (browser)
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        Get OS-level notifications even when the Mindspace tab is closed — safety alerts,
        new insights, streak milestones and peer messages will surface on your device.
        Independent of the in-app notification preference above.
      </p>

      {status === 'loading' && (
        <p style={{ color: 'var(--text-secondary)' }}>Checking notification status…</p>
      )}

      {status === 'unsupported' && (
        <p style={{ color: 'var(--text-secondary)' }}>
          Your browser does not support push notifications.
        </p>
      )}

      {status === 'denied' && (
        <p style={{ color: 'var(--danger-color)' }}>
          Notifications are blocked for this site. To enable, change the site permissions in
          your browser settings, then reload this page.
        </p>
      )}

      {status === 'disabled' && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleEnable}
          disabled={busy}
        >
          {busy ? 'Enabling…' : 'Enable push notifications'}
        </button>
      )}

      {status === 'enabled' && (
        <button
          type="button"
          className="btn"
          onClick={handleDisable}
          disabled={busy}
          style={{ backgroundColor: 'var(--surface)' }}
        >
          {busy ? 'Disabling…' : 'Disable push notifications'}
        </button>
      )}

      {message && (
        <p
          style={{
            marginTop: 'var(--spacing-md)',
            color: isError ? 'var(--danger-color)' : 'var(--text-secondary)'
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

// Privacy Settings Component
const PrivacySettings = ({ user: _user, setSuccess }) => {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const { logout } = useAuth();

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const response = await authAPI.downloadDataExport();

      // Create downloadable file
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindspace_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Your data has been exported and downloaded.');
    } catch (error) {
      alert('Failed to export data. Please try again.');
      console.error('Export error:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    try {
      await authAPI.permanentDeleteAccount('DELETE_MY_ACCOUNT');
      alert('Your account has been permanently deleted.');
      logout();
    } catch (error) {
      alert('Failed to delete account. Please try again.');
      console.error('Delete error:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      {/* Phase 1.1 (2026-06-15): at-a-glance summary of the privacy mechanisms.
          Pure presentational, no API. Renders above the existing controls so a
          first-time visitor reads WHAT protects them before WHICH controls to use. */}
      <PrivacyNutritionLabel />

      {/* Phase 1.2 (2026-06-15): user-facing audit log verification.
          Surfaces ADR-0004's hash chain as a clickable Verify + Download UI. */}
      <AuditLogVerification />

    <div className="card">
      <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Privacy & Data</h2>

      {/* Data Export Section */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span>📥</span> Export Your Data
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          Download all your MindSpace data including mood entries, insights, chat history, and achievements in JSON format.
        </p>
        <button
          className="btn btn-primary"
          onClick={handleExportData}
          disabled={exportLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
        >
          {exportLoading ? (
            <>
              <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
              Generating Export...
            </>
          ) : (
            <>
              <span>📦</span>
              Download My Data
            </>
          )}
        </button>
      </div>

      {/* GDPR Info Section */}
      <div style={{
        marginBottom: 'var(--spacing-xl)',
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--primary-light)',
        borderRadius: 'var(--radius-lg)',
        borderLeft: '4px solid var(--primary-color)'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span>🔒</span> GDPR Compliance
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
          This application complies with UK GDPR and the Data Protection Act 2018. Your rights include:
        </p>
        <ul style={{ color: 'var(--text-secondary)', marginLeft: 'var(--spacing-lg)', fontSize: 'var(--font-size-small)' }}>
          <li>Right to access your data (export feature above)</li>
          <li>Right to rectification (edit in Settings)</li>
          <li>Right to erasure (delete account below)</li>
          <li>Right to data portability (JSON export)</li>
        </ul>
      </div>

      {/* Phase 1.3 step 8 (ADR-0009): upgrade legacy server-encrypted notes
          to E2EE. Self-hides if the user has not completed E2EE setup. */}
      <UpgradeNotesToE2EE />

      {/* On-device sentiment opt-in (ADR-0006) */}
      <OnDeviceSentimentToggle />

      {/* Delete Account Section */}
      <div style={{
        padding: 'var(--spacing-lg)',
        backgroundColor: '#FFF5F5',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #FFCCCC'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span>⚠️</span> Delete Account
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
        </p>

        {!showDeleteConfirm ? (
          <button
            className="btn"
            style={{ backgroundColor: 'var(--danger-color)', color: 'white' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete My Account
          </button>
        ) : (
          <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'white', borderRadius: 'var(--radius-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', fontWeight: 500 }}>
              Type <strong>DELETE</strong> to confirm account deletion:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="form-input"
              style={{ marginBottom: 'var(--spacing-md)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button
                className="btn"
                style={{ backgroundColor: 'var(--danger-color)', color: 'white' }}
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                className="btn"
                style={{ backgroundColor: 'var(--surface)' }}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

// On-device sentiment opt-in toggle (ADR-0006).
// Lives in the Privacy tab. localStorage-backed so the choice is per-browser,
// not synced to the server (the whole point is that the server learns nothing
// about the user's text). On enable, primes the Transformers.js model so the
// first real analysis in MoodTracker is fast.
const OnDeviceSentimentToggle = () => {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(SENTIMENT_OPT_IN_KEY) === '1'; }
    catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');
    try {
      // Dynamic import keeps the ~700 KB Transformers.js dep out of every
      // bundle that ships Settings — it's only loaded when the user
      // actually clicks Enable, which aligns with ADR-0006's "lazy load
      // on first opt-in click" principle.
      const { getReady } = await import('../services/sentimentService');
      await getReady();                   // downloads the ~67 MB model (cached after first time)
      localStorage.setItem(SENTIMENT_OPT_IN_KEY, '1');
      setEnabled(true);
      setMessage('On-device sentiment enabled. Your journal text will be analysed on this device only — the server never receives the words you type.');
    } catch (err) {
      setMessage(`Could not download the sentiment model: ${err && err.message ? err.message : 'unknown error'}. The feature stays off and your journal text remains private.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = () => {
    try { localStorage.setItem(SENTIMENT_OPT_IN_KEY, '0'); } catch { /* noop */ }
    setEnabled(false);
    setMessage('On-device sentiment disabled. No further analysis will run.');
  };

  const isError = message && /could not|fail|error/i.test(message);

  return (
    <div
      style={{
        marginTop: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-xl)',
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--primary-light)',
        borderRadius: 'var(--radius-lg)',
        borderLeft: '4px solid var(--primary-color)'
      }}
    >
      <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span>🧠</span> On-device sentiment analysis
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        Get a sentiment score for your journal notes without ever sending the text to a server.
        A small language model runs entirely in your browser. Only the resulting score and label
        leave your device — never the words themselves.
      </p>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-small)', marginBottom: 'var(--spacing-md)' }}>
        First-time enable downloads a ~67 MB model. After that it is cached locally and runs in under a second.
      </p>

      {!enabled && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleEnable}
          disabled={busy}
        >
          {busy ? 'Downloading model…' : 'Enable on-device sentiment'}
        </button>
      )}

      {enabled && (
        <button
          type="button"
          className="btn"
          onClick={handleDisable}
          disabled={busy}
          style={{ backgroundColor: 'var(--surface)' }}
        >
          Disable on-device sentiment
        </button>
      )}

      {message && (
        <p
          style={{
            marginTop: 'var(--spacing-md)',
            color: isError ? 'var(--danger-color)' : 'var(--text-secondary)',
            fontSize: 'var(--font-size-small)'
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default Settings;
