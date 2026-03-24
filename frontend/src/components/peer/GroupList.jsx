import React from 'react';
import GroupCard from './GroupCard';

/**
 * GroupList Component
 * Displays a grid of peer support groups
 */
const GroupList = ({ groups, joinedGroups, onJoin, onLeave, onSelectGroup, isLoading }) => {
  const categories = [
    { value: 'all', label: 'All Groups' },
    { value: 'anxiety', label: 'Anxiety' },
    { value: 'depression', label: 'Depression' },
    { value: 'stress', label: 'Stress' },
    { value: 'general', label: 'General Support' },
    { value: 'grief', label: 'Grief & Loss' },
    { value: 'relationships', label: 'Relationships' },
    { value: 'work', label: 'Work & Career' },
    { value: 'wellness', label: 'Wellness' }
  ];

  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter groups
  const filteredGroups = groups.filter(group => {
    const matchesCategory = selectedCategory === 'all' || group.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Check if user is member of a group
  const getMembership = (groupId) => {
    return joinedGroups.find(m => m.group_id === groupId);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'var(--spacing-xl)',
        minHeight: '200px'
      }}>
        <div className="spinner" aria-label="Loading groups"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div style={{
        marginBottom: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            style={{
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              paddingLeft: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              fontSize: 'var(--font-size-base)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)'
            }}
            aria-label="Search groups"
          />
          <span style={{
            position: 'absolute',
            left: 'var(--spacing-md)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }}>
            🔍
          </span>
        </div>

        {/* Category filters */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-xs)',
          flexWrap: 'wrap'
        }}>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                borderRadius: 'var(--radius-lg)',
                border: selectedCategory === cat.value ? 'none' : '1px solid var(--border)',
                backgroundColor: selectedCategory === cat.value ? 'var(--primary-color)' : 'var(--surface)',
                color: selectedCategory === cat.value ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-small)',
                transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groups grid */}
      {filteredGroups.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
          color: 'var(--text-secondary)'
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-md)' }}>🔍</span>
          <p>No groups found matching your criteria.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--spacing-lg)'
        }}>
          {filteredGroups.map(group => {
            const membership = getMembership(group.id);
            return (
              <div
                key={group.id}
                onClick={() => membership && onSelectGroup(group, membership)}
                style={{ cursor: membership ? 'pointer' : 'default' }}
              >
                <GroupCard
                  group={group}
                  isJoined={!!membership}
                  membership={membership}
                  onJoin={onJoin}
                  onLeave={onLeave}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupList;
