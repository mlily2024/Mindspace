import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate password length before attempting login
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters. Please check your password and try again.');
      setLoading(false);
      return;
    }

    const result = await login(formData);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)'
  };

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
    padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xxl)',
    maxWidth: '450px',
    width: '100%',
    boxShadow: 'var(--shadow-lg)'
  };

  const inputStyle = {
    width: '100%',
    padding: 'var(--spacing-md)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    fontSize: '16px', // Prevents iOS zoom on focus
    background: 'var(--background)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.2s'
  };

  const btnStyle = {
    width: '100%',
    padding: 'var(--spacing-md)',
    background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'white',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 15px rgba(155, 138, 165, 0.3)'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle} className="animate-fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>🌙</span>
            <h1 style={{
              fontSize: 'var(--font-size-xxl)',
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Welcome Back
            </h1>
          </Link>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
            Sign in to continue your wellness journey
          </p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--spacing-md)',
            background: '#FEE8E8',
            borderRadius: 'var(--radius-md)',
            color: '#D32F2F',
            marginBottom: 'var(--spacing-lg)',
            fontSize: 'var(--font-size-small)'
          }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              style={inputStyle}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              style={inputStyle}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="current-password"
              placeholder="At least 8 characters"
            />
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)'
            }}>
              Password must be at least 8 characters
            </p>
          </div>

          <button
            type="submit"
            style={{
              ...btnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--primary-color)',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              Create Account
            </Link>
          </p>
        </div>

        {/* Crisis Resources */}
        <div style={{
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-md)',
          background: 'var(--background)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            Need immediate support?
          </p>
          <Link
            to="/crisis-resources"
            style={{
              color: '#E8A5A5',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 'var(--font-size-small)'
            }}
          >
            💚 Crisis Resources
          </Link>
        </div>

        {/* Back to Home */}
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
          <Link
            to="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-small)'
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
