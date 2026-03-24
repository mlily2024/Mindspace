import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    userGroup: null
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
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

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    // Clean form data - remove null/empty values to avoid validation issues
    const cleanedData = {
      email: formData.email,
      password: formData.password,
      ...(formData.username && { username: formData.username }),
      ...(formData.userGroup && { userGroup: formData.userGroup })
    };

    const result = await register(cleanedData);

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
    maxWidth: '450px',
    width: '100%',
    background: 'var(--surface)',
    borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
    padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xxl)',
    boxShadow: 'var(--shadow-lg)',
    animation: 'fadeInUp 0.5s var(--animation-smooth)'
  };

  const logoStyle = {
    textAlign: 'center',
    marginBottom: 'var(--spacing-xl)'
  };

  const inputStyle = {
    width: '100%',
    padding: 'var(--spacing-md)',
    fontSize: '16px', // Prevents iOS zoom on focus
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--background)',
    color: 'var(--text-primary)',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    fontFamily: 'var(--font-family-primary)'
  };

  const buttonStyle = {
    width: '100%',
    padding: 'var(--spacing-md) var(--spacing-xl)',
    background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: loading ? 'wait' : 'pointer',
    boxShadow: '0 4px 15px rgba(155, 138, 165, 0.4)',
    transition: 'all var(--transition-fast)',
    opacity: loading ? 0.7 : 1,
    marginBottom: 'var(--spacing-lg)'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={logoStyle}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-sm)' }}>
            <span role="img" aria-hidden="true">🌙</span>
          </div>
          <h1 style={{
            fontSize: 'var(--font-size-xxl)',
            fontFamily: 'var(--font-family-heading)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Welcome to MindSpace
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-base)'
          }}>
            Your personal wellness companion
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            style={{
              background: 'linear-gradient(135deg, #FDE8E8, #FCDCDC)',
              borderLeft: '4px solid var(--danger-color)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
              color: '#6B2D2D'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              style={inputStyle}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              aria-required="true"
              placeholder="your@email.com"
            />
          </div>

          {/* Username (optional) */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              What should we call you?
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 'var(--spacing-xs)' }}>
                (optional)
              </span>
            </label>
            <input
              type="text"
              id="username"
              style={inputStyle}
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="username"
              placeholder="Your name or nickname"
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                style={{ ...inputStyle, paddingRight: '50px' }}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength="8"
                autoComplete="new-password"
                aria-required="true"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 'var(--spacing-xs)',
                  color: 'var(--text-secondary)'
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            style={buttonStyle}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
                Creating your space...
              </span>
            ) : (
              'Get Started'
            )}
          </button>

          {/* Sign In Link */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Already have an account?{' '}
              <Link
                to="/login"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>

        {/* Privacy Note */}
        <div style={{
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-md)',
          background: 'var(--primary-light)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)'
          }}>
            <span role="img" aria-hidden="true">🔒</span>{' '}
            Your data is encrypted and private. We never share your personal information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
