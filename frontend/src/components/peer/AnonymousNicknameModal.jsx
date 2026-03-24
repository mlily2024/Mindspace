import React, { useState, useEffect } from 'react';

/**
 * AnonymousNicknameModal Component
 * Modal for selecting or generating an anonymous nickname when joining a group
 */
const AnonymousNicknameModal = ({ isOpen, onClose, onJoin, groupName }) => {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generate random nickname suggestions
  const adjectives = ['Calm', 'Brave', 'Gentle', 'Kind', 'Wise', 'Hopeful', 'Peaceful', 'Warm', 'Strong', 'Bright'];
  const nouns = ['Phoenix', 'River', 'Star', 'Cloud', 'Mountain', 'Meadow', 'Ocean', 'Forest', 'Dawn', 'Moon'];

  const generateNickname = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
  };

  useEffect(() => {
    if (isOpen) {
      setNickname(generateNickname());
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (nickname.length < 3 || nickname.length > 20) {
      setError('Nickname must be between 3 and 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setError('Nickname can only contain letters, numbers, and underscores');
      return;
    }

    setIsLoading(true);
    try {
      await onJoin(nickname);
    } catch (err) {
      setError(err.message || 'Failed to join group');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          maxWidth: '400px',
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUp 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>🎭</span>
          <h2 id="nickname-modal-title" style={{ margin: 0, color: 'var(--text-primary)' }}>
            Join {groupName}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
            Choose an anonymous nickname to protect your privacy
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label
              htmlFor="nickname-input"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-small)'
              }}
            >
              Your Anonymous Nickname
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <input
                id="nickname-input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter nickname..."
                style={{
                  flex: 1,
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--font-size-base)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text-primary)'
                }}
                disabled={isLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setNickname(generateNickname())}
                style={{
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  cursor: 'pointer',
                  fontSize: '1.2rem'
                }}
                title="Generate random nickname"
                aria-label="Generate random nickname"
                disabled={isLoading}
              >
                🎲
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger-color)',
                fontSize: 'var(--font-size-small)',
                marginBottom: 'var(--spacing-md)'
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Info */}
          <div
            style={{
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--background)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--spacing-lg)'
            }}
          >
            <p style={{ margin: 0 }}>
              🔒 Your real identity is never shown to other members. Only your nickname will be visible.
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)'
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                opacity: isLoading ? 0.7 : 1
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnonymousNicknameModal;
