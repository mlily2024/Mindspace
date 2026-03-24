import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import GroupList from '../components/peer/GroupList';
import ChatRoom from '../components/peer/ChatRoom';
import AnonymousNicknameModal from '../components/peer/AnonymousNicknameModal';
import { peerSupportAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';

/**
 * PeerSupport Page
 * Main page for peer support feature with groups and real-time chat
 */
const PeerSupport = () => {
  const { isConnected } = useSocket();
  const [groups, setGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [selectedGroupToJoin, setSelectedGroupToJoin] = useState(null);

  // Chat state
  const [activeChat, setActiveChat] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);

  // Load groups and memberships
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [groupsResponse, myGroupsResponse] = await Promise.all([
          peerSupportAPI.getGroups(),
          peerSupportAPI.getMyGroups()
        ]);

        setGroups(groupsResponse.data?.groups || []);
        setJoinedGroups(myGroupsResponse.data?.memberships || []);
      } catch (err) {
        console.error('Failed to load peer support data:', err);
        setError('Failed to load groups. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle joining a group
  const handleJoinClick = (group) => {
    setSelectedGroupToJoin(group);
    setShowNicknameModal(true);
  };

  // Handle join confirmation with nickname
  const handleJoinConfirm = async (nickname) => {
    if (!selectedGroupToJoin) return;

    try {
      const response = await peerSupportAPI.joinGroup(selectedGroupToJoin.id, nickname);
      const membership = response.data?.membership;

      if (membership) {
        setJoinedGroups(prev => [...prev, membership]);

        // Update group member count
        setGroups(prev =>
          prev.map(g =>
            g.id === selectedGroupToJoin.id
              ? { ...g, member_count: (g.member_count || 0) + 1 }
              : g
          )
        );
      }

      setShowNicknameModal(false);
      setSelectedGroupToJoin(null);
    } catch (err) {
      throw new Error(err.error || 'Failed to join group');
    }
  };

  // Handle leaving a group
  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;

    try {
      await peerSupportAPI.leaveGroup(groupId);

      setJoinedGroups(prev => prev.filter(m => m.group_id !== groupId));

      // Update group member count
      setGroups(prev =>
        prev.map(g =>
          g.id === groupId
            ? { ...g, member_count: Math.max(0, (g.member_count || 1) - 1) }
            : g
        )
      );

      // Close chat if leaving active group
      if (activeChat?.id === groupId) {
        setActiveChat(null);
        setActiveMembership(null);
      }
    } catch (err) {
      console.error('Failed to leave group:', err);
      alert('Failed to leave group. Please try again.');
    }
  };

  // Handle selecting a group to chat
  const handleSelectGroup = (group, membership) => {
    setActiveChat(group);
    setActiveMembership(membership);
  };

  // Handle going back from chat
  const handleBackFromChat = () => {
    setActiveChat(null);
    setActiveMembership(null);
  };

  // If in chat mode, show full-screen chat
  if (activeChat && activeMembership) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ChatRoom
          group={activeChat}
          membership={activeMembership}
          onBack={handleBackFromChat}
        />
      </div>
    );
  }

  return (
    <div className="peer-support-page">
      <Navigation />

      <main id="main-content" className="main-content" style={{ padding: 'var(--spacing-lg)' }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 'var(--spacing-md)'
          }}>
            <div>
              <h1 style={{ margin: '0 0 var(--spacing-sm) 0', color: 'var(--text-primary)' }}>
                Peer Support
              </h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '600px' }}>
                Connect with others who understand what you're going through.
                Join anonymous support groups and share your experiences in a safe, moderated environment.
              </p>
            </div>

            {/* Connection status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              backgroundColor: isConnected ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 0, 0, 0.1)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--font-size-small)'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? 'var(--success-color)' : 'var(--danger-color)'
              }} />
              <span style={{ color: isConnected ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Safety banner */}
        <div
          style={{
            backgroundColor: 'var(--primary-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>💙</span>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Need immediate help?</strong>
            <p style={{ margin: 'var(--spacing-xs) 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
              If you're in crisis, please reach out to professional support services.
            </p>
          </div>
          <Link
            to="/crisis-resources"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-small)',
              whiteSpace: 'nowrap'
            }}
          >
            Crisis Resources
          </Link>
        </div>

        {/* My Groups Section */}
        {joinedGroups.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{
              margin: '0 0 var(--spacing-md) 0',
              fontSize: 'var(--font-size-lg)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)'
            }}>
              <span>🏠</span> My Groups
            </h2>

            <div style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              flexWrap: 'wrap'
            }}>
              {joinedGroups.map(membership => {
                const group = groups.find(g => g.id === membership.group_id);
                if (!group) return null;

                return (
                  <button
                    key={membership.group_id}
                    onClick={() => handleSelectGroup(group, membership)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'var(--surface)';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>💬</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{group.name}</div>
                      <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                        as {membership.anonymous_nickname}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger-color)',
              marginBottom: 'var(--spacing-lg)',
              textAlign: 'center'
            }}
            role="alert"
          >
            {error}
            <button
              onClick={() => window.location.reload()}
              style={{
                marginLeft: 'var(--spacing-md)',
                padding: 'var(--spacing-xs) var(--spacing-md)',
                backgroundColor: 'var(--danger-color)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* All Groups Section */}
        <div>
          <h2 style={{
            margin: '0 0 var(--spacing-md) 0',
            fontSize: 'var(--font-size-lg)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <span>🌐</span> Browse Groups
          </h2>

          <GroupList
            groups={groups}
            joinedGroups={joinedGroups}
            onJoin={handleJoinClick}
            onLeave={handleLeaveGroup}
            onSelectGroup={handleSelectGroup}
            isLoading={isLoading}
          />
        </div>

        {/* Guidelines */}
        <div
          style={{
            marginTop: 'var(--spacing-xl)',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)'
          }}
        >
          <h3 style={{ margin: '0 0 var(--spacing-md) 0', color: 'var(--text-primary)' }}>
            Community Guidelines
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: 'var(--spacing-lg)',
            color: 'var(--text-secondary)',
            lineHeight: 1.8
          }}>
            <li>Be kind and respectful to all members</li>
            <li>Your identity is protected - only your anonymous nickname is visible</li>
            <li>Do not share personal identifying information</li>
            <li>Report any inappropriate content or concerning messages</li>
            <li>This is peer support, not professional therapy - seek professional help when needed</li>
          </ul>
        </div>
      </main>

      {/* Nickname Modal */}
      <AnonymousNicknameModal
        isOpen={showNicknameModal}
        onClose={() => {
          setShowNicknameModal(false);
          setSelectedGroupToJoin(null);
        }}
        onJoin={handleJoinConfirm}
        groupName={selectedGroupToJoin?.name || ''}
      />
    </div>
  );
};

export default PeerSupport;
