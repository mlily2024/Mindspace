import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [moodEntries, setMoodEntries] = useState([]);
  const [logs, setLogs] = useState({ fileLogs: [], auditLogs: [] });
  const [testDataConfig, setTestDataConfig] = useState({
    userCount: 5,
    entriesPerUser: 10,
    includeInsights: true,
    includeRecommendations: true
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // Check if admin token exists
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoodEntries = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getMoodEntries({ limit: 50 });
      setMoodEntries(response.data.data.entries);
    } catch (error) {
      console.error('Failed to load mood entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getLogs({ lines: 50 });
      setLogs(response.data.data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage({ type: '', text: '' });

    switch (tab) {
      case 'stats':
        loadStats();
        break;
      case 'users':
        loadUsers();
        break;
      case 'entries':
        loadMoodEntries();
        break;
      case 'logs':
        loadLogs();
        break;
      default:
        break;
    }
  };

  const handleManageUser = async (userId, action) => {
    try {
      await adminAPI.manageUser(userId, action);
      setMessage({ type: 'success', text: `User ${action}d successfully` });
      loadUsers();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update user' });
    }
  };

  const handleGenerateTestData = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.generateTestData(testDataConfig);
      setMessage({
        type: 'success',
        text: `Created ${response.data.data.usersCreated} users with ${response.data.data.entriesCreated} mood entries`
      });
      loadStats();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate test data' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTestData = async () => {
    if (!window.confirm('Are you sure you want to delete all test data?')) return;

    setLoading(true);
    try {
      const response = await adminAPI.deleteTestData();
      setMessage({
        type: 'success',
        text: `Deleted ${response.data.data.usersDeleted} test users`
      });
      loadStats();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete test data' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const tabs = [
    { id: 'stats', label: 'Statistics', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'entries', label: 'Mood Entries', icon: '📝' },
    { id: 'logs', label: 'System Logs', icon: '📋' },
    { id: 'testdata', label: 'Test Data', icon: '🧪' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: 'var(--spacing-md) var(--spacing-lg)'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 0 }}>
              Developer Panel
            </h1>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
              Mental Health Tracker Admin
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <a href="/" className="btn btn-outline">Back to App</a>
            <button onClick={handleLogout} className="btn btn-outline">Logout</button>
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: 'var(--spacing-xl)' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-xl)',
          flexWrap: 'wrap'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}
               style={{ marginBottom: 'var(--spacing-lg)' }}>
            {message.text}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading"></div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && !loading && stats && (
          <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)' }}>
            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>User Statistics</h2>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                <StatRow label="Total Users" value={stats.statistics.total_users} />
                <StatRow label="Active Users" value={stats.statistics.active_users} />
                <StatRow label="Anonymous Users" value={stats.statistics.anonymous_users} />
                <StatRow label="New Users (7 days)" value={stats.statistics.new_users_last_7d} />
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Mood Data</h2>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                <StatRow label="Total Mood Entries" value={stats.statistics.total_mood_entries} />
                <StatRow label="Entries (24h)" value={stats.statistics.entries_last_24h} />
                <StatRow label="Entries (7 days)" value={stats.statistics.entries_last_7d} />
                <StatRow label="Avg Mood Score" value={parseFloat(stats.statistics.avg_mood_score || 0).toFixed(1)} />
                <StatRow label="Avg Stress Level" value={parseFloat(stats.statistics.avg_stress_level || 0).toFixed(1)} />
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Insights & Alerts</h2>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                <StatRow label="Total Insights" value={stats.statistics.total_insights} />
                <StatRow label="Total Recommendations" value={stats.statistics.total_recommendations} />
                <StatRow label="Safety Alerts" value={stats.statistics.total_safety_alerts} />
                <StatRow label="Unacknowledged Alerts" value={stats.statistics.unacknowledged_alerts} highlight />
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>User Groups</h2>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {stats.userGroups.map(group => (
                  <StatRow key={group.user_group} label={group.user_group || 'Other'} value={group.count} />
                ))}
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>System Info</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
                <StatRow label="Environment" value={stats.environment} />
                <StatRow label="Server Time" value={new Date(stats.serverTime).toLocaleString()} />
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && !loading && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>All Users ({users.length})</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>Username</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Group</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Entries</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{user.username}</td>
                    <td style={tdStyle}>{user.email || '(anonymous)'}</td>
                    <td style={tdStyle}>{user.user_group}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: user.account_status === 'active' ? 'var(--success-color)' : 'var(--danger-color)',
                        color: 'white',
                        fontSize: 'var(--font-size-small)'
                      }}>
                        {user.account_status}
                      </span>
                    </td>
                    <td style={tdStyle}>{user.mood_entries_count}</td>
                    <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={tdStyle}>
                      {user.account_status === 'active' ? (
                        <button
                          onClick={() => handleManageUser(user.user_id, 'deactivate')}
                          className="btn btn-outline"
                          style={{ fontSize: 'var(--font-size-small)', padding: '4px 8px' }}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleManageUser(user.user_id, 'activate')}
                          className="btn btn-primary"
                          style={{ fontSize: 'var(--font-size-small)', padding: '4px 8px' }}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mood Entries Tab */}
        {activeTab === 'entries' && !loading && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Recent Mood Entries ({moodEntries.length})</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Mood</th>
                  <th style={thStyle}>Energy</th>
                  <th style={thStyle}>Stress</th>
                  <th style={thStyle}>Anxiety</th>
                  <th style={thStyle}>Sleep</th>
                  <th style={thStyle}>Social</th>
                </tr>
              </thead>
              <tbody>
                {moodEntries.map(entry => (
                  <tr key={entry.entry_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{entry.username || 'Unknown'}</td>
                    <td style={tdStyle}>{new Date(entry.entry_date).toLocaleDateString()}</td>
                    <td style={tdStyle}><ScoreBadge value={entry.mood_score} /></td>
                    <td style={tdStyle}><ScoreBadge value={entry.energy_level} /></td>
                    <td style={tdStyle}><ScoreBadge value={entry.stress_level} inverted /></td>
                    <td style={tdStyle}><ScoreBadge value={entry.anxiety_level} inverted /></td>
                    <td style={tdStyle}>{entry.sleep_hours}h</td>
                    <td style={tdStyle}><ScoreBadge value={entry.social_interaction_quality} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && !loading && (
          <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)' }}>
            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Application Logs</h2>
              <div style={{
                maxHeight: '400px',
                overflow: 'auto',
                backgroundColor: '#1a1a2e',
                color: '#00ff00',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace',
                fontSize: 'var(--font-size-small)'
              }}>
                {logs.fileLogs.length > 0 ? (
                  logs.fileLogs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>{log}</div>
                  ))
                ) : (
                  <div>No log entries found</div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Audit Logs</h2>
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {logs.auditLogs.length > 0 ? (
                  logs.auditLogs.map(log => (
                    <div key={log.log_id} style={{
                      padding: 'var(--spacing-sm)',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 'var(--font-size-small)'
                    }}>
                      <div><strong>{log.action}</strong></div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {log.resource_type} | {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No audit logs found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test Data Tab */}
        {activeTab === 'testdata' && !loading && (
          <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)' }}>
            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Generate Test Data</h2>
              <div className="form-group">
                <label className="form-label">Number of Users</label>
                <input
                  type="number"
                  className="form-input"
                  value={testDataConfig.userCount}
                  onChange={(e) => setTestDataConfig({ ...testDataConfig, userCount: parseInt(e.target.value) })}
                  min="1"
                  max="50"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Entries per User</label>
                <input
                  type="number"
                  className="form-input"
                  value={testDataConfig.entriesPerUser}
                  onChange={(e) => setTestDataConfig({ ...testDataConfig, entriesPerUser: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <input
                    type="checkbox"
                    checked={testDataConfig.includeInsights}
                    onChange={(e) => setTestDataConfig({ ...testDataConfig, includeInsights: e.target.checked })}
                  />
                  Include Insights
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <input
                    type="checkbox"
                    checked={testDataConfig.includeRecommendations}
                    onChange={(e) => setTestDataConfig({ ...testDataConfig, includeRecommendations: e.target.checked })}
                  />
                  Include Recommendations
                </label>
              </div>
              <button
                onClick={handleGenerateTestData}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Generate Test Data
              </button>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Cleanup</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                Remove all test users and their associated data. This will delete users with emails matching "testuser*@test.com".
              </p>
              <button
                onClick={handleDeleteTestData}
                className="btn"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--danger-color)',
                  color: 'white'
                }}
              >
                Delete All Test Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper components
const StatRow = ({ label, value, highlight }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--spacing-sm)',
    backgroundColor: highlight ? 'var(--warning-color-light)' : 'var(--background)',
    borderRadius: 'var(--radius-sm)'
  }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ fontWeight: 'bold' }}>{value}</span>
  </div>
);

const ScoreBadge = ({ value, inverted }) => {
  const numValue = parseInt(value);
  let color = 'var(--text-secondary)';

  if (inverted) {
    color = numValue >= 7 ? 'var(--danger-color)' : numValue >= 4 ? 'var(--warning-color)' : 'var(--success-color)';
  } else {
    color = numValue >= 7 ? 'var(--success-color)' : numValue >= 4 ? 'var(--warning-color)' : 'var(--danger-color)';
  }

  return (
    <span style={{
      fontWeight: 'bold',
      color: color
    }}>
      {value}/10
    </span>
  );
};

const thStyle = {
  textAlign: 'left',
  padding: 'var(--spacing-md)',
  fontWeight: 'bold'
};

const tdStyle = {
  padding: 'var(--spacing-md)'
};

export default AdminDashboard;
