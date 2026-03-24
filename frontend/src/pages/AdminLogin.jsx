import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminStatus, setAdminStatus] = useState(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const response = await adminAPI.checkStatus();
      setAdminStatus(response.data.data);

      // If in development mode, auto-login
      if (response.data.data.isDevelopment && response.data.data.isAuthenticated) {
        handleDevModeLogin();
      }
    } catch (err) {
      console.error('Failed to check admin status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDevModeLogin = async () => {
    try {
      const response = await adminAPI.login('');
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.data.token);
        navigate('/admin/dashboard');
      }
    } catch (err) {
      console.error('Dev mode login failed:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await adminAPI.login(password);
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.data.token);
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--background)'
      }}>
        <div className="spinner" aria-label="Loading"></div>
      </div>
    );
  }

  return (
    <main style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--background)',
      padding: 'var(--spacing-lg)'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>Developer Panel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Admin access for development and testing
          </p>
        </div>

        {adminStatus?.isDevelopment && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <strong>Development Mode Active</strong>
            <p style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-small)' }}>
              Password is optional in development mode.
            </p>
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Admin Password
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={adminStatus?.isDevelopment ? 'Optional in dev mode' : 'Enter admin password'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Access Developer Panel'}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--spacing-xl)',
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <a
            href="/"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Back to main application
          </a>
        </div>

        {adminStatus && (
          <div style={{
            marginTop: 'var(--spacing-lg)',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--background)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)'
          }}>
            <strong>Status:</strong>
            <ul style={{ marginTop: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-lg)' }}>
              <li>Mode: {adminStatus.isDevelopment ? 'Development' : 'Production'}</li>
              <li>Password Required: {adminStatus.requiresPassword ? 'Yes' : 'No'}</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminLogin;
