import React from 'react';

/**
 * GroupCard Component
 * Displays a peer support group card with join/leave functionality
 */
const GroupCard = ({ group, onJoin, onLeave, isJoined, membership }) => {
  const getCategoryIcon = (category) => {
    const icons = {
      anxiety: '😰',
      depression: '💙',
      stress: '😤',
      general: '🤝',
      grief: '💔',
      relationships: '❤️',
      work: '💼',
      wellness: '🌱'
    };
    return icons[category] || icons.general;
  };

  return (
    <div
      className="group-card"
      style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: isJoined ? '2px solid var(--primary-color)' : '1px solid var(--border)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <span style={{ fontSize: '2rem' }}>{getCategoryIcon(group.category)}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
            {group.name}
          </h3>
          <span
            style={{
              display: 'inline-block',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--background)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              marginTop: 'var(--spacing-xs)'
            }}
          >
            {group.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-base)',
        marginBottom: 'var(--spacing-md)',
        lineHeight: 1.5
      }}>
        {group.description}
      </p>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-md)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-small)'
      }}>
        <span>👥 {group.member_count || 0} members</span>
        <span>🟢 {group.online_count || 0} online</span>
      </div>

      {/* Action Button */}
      {isJoined ? (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLeave(group.id);
            }}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'transparent',
              border: '1px solid var(--danger-color)',
              color: 'var(--danger-color)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-color)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--danger-color)';
            }}
          >
            Leave Group
          </button>
          {membership && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)'
            }}>
              as {membership.anonymous_nickname}
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin(group);
          }}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'var(--primary-color)',
            border: 'none',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          Join Group
        </button>
      )}
    </div>
  );
};

export default GroupCard;
