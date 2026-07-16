import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err?.message || 'This reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const pageStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)',
    padding: 'var(--spacing-lg)'
  };
  const cardStyle = {
    background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--spacing-xxl)',
    maxWidth: '450px', width: '100%', boxShadow: 'var(--shadow-lg)'
  };
  const inputStyle = {
    width: '100%', padding: 'var(--spacing-md)', border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)', fontSize: '16px', background: 'var(--background)',
    color: 'var(--text-primary)'
  };
  const btnStyle = {
    width: '100%', padding: 'var(--spacing-md)',
    background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
    border: 'none', borderRadius: 'var(--radius-lg)', color: 'white',
    fontSize: 'var(--font-size-base)', fontWeight: 600, cursor: 'pointer'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>🔒</span>
          <h1 style={{ fontSize: 'var(--font-size-xxl)', fontFamily: 'var(--font-family-heading)', color: 'var(--text-primary)', margin: 0 }}>
            Choose a new password
          </h1>
        </div>

        {done ? (
          <div style={{ padding: 'var(--spacing-md)', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', textAlign: 'center' }} role="status">
            Your password has been reset. Redirecting you to sign in...
          </div>
        ) : !token ? (
          <div>
            <div style={{ padding: 'var(--spacing-md)', background: '#FEE8E8', borderRadius: 'var(--radius-md)', color: '#D32F2F', marginBottom: 'var(--spacing-lg)' }} role="alert">
              This reset link is missing its token. Please request a new link.
            </div>
            <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: 'var(--spacing-md)', background: '#FEE8E8', borderRadius: 'var(--radius-md)', color: '#D32F2F', marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-small)' }} role="alert">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label htmlFor="password" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  New password
                </label>
                <input
                  type="password" id="password" style={inputStyle} value={password}
                  onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <label htmlFor="confirm" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Confirm new password
                </label>
                <input
                  type="password" id="confirm" style={inputStyle} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password"
                  placeholder="Re-enter your new password"
                />
              </div>
              <button type="submit" style={{ ...btnStyle, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
              <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
