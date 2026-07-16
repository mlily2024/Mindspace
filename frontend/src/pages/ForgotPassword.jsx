import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
    } catch (_err) {
      // The endpoint returns a generic 200 regardless; even on a network error
      // we show the same neutral confirmation (never reveal account state).
    } finally {
      setLoading(false);
      setSubmitted(true);
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
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>🔑</span>
          <h1 style={{ fontSize: 'var(--font-size-xxl)', fontFamily: 'var(--font-family-heading)', color: 'var(--text-primary)', margin: 0 }}>
            Reset your password
          </h1>
        </div>

        {submitted ? (
          <div>
            <div style={{ padding: 'var(--spacing-md)', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 'var(--spacing-lg)' }} role="status">
              If an account exists for that email, we have sent a password reset link.
              Please check your inbox (and spam folder). The link expires in 1 hour.
            </div>
            <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Email Address
                </label>
                <input
                  type="email" id="email" style={inputStyle} value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" style={{ ...btnStyle, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
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

export default ForgotPassword;
