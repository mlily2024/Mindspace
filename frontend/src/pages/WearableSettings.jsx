import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '../components/Navigation';
import { WearableDeviceList, BiometricSummaryCard } from '../components/WearableCard';
import BiometricInsights, { CorrelationDisplay } from '../components/BiometricInsights';
import { wearablesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * WearableSettings - Main page for wearable device management and biometric insights
 */
const WearableSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('devices');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [connections, setConnections] = useState([]);
  const [biometrics, setBiometrics] = useState([]);
  const [correlations, setCorrelations] = useState(null);
  const [insights, setInsights] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Check URL params for connection result
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const errorMsg = urlParams.get('error');
    const successParam = urlParams.get('success');

    if (connected && successParam === 'true') {
      setSuccess(`Successfully connected ${connected.replace('_', ' ')}!`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [devicesRes, connectionsRes, biometricsRes, correlationsRes, insightsRes] = await Promise.all([
        wearablesAPI.getAvailableDevices(),
        wearablesAPI.getConnections(),
        wearablesAPI.getLatestBiometrics(),
        wearablesAPI.getCorrelations(),
        wearablesAPI.getInsights(false, 20)
      ]);

      setDevices(devicesRes.data || []);
      setConnections(connectionsRes.data || []);
      setBiometrics(biometricsRes.data || []);
      setCorrelations(correlationsRes.data || null);
      setInsights(insightsRes.data || []);
    } catch (err) {
      console.error('Error loading wearable data:', err);
      setError('Failed to load wearable data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle device connection
  const handleConnect = async (deviceType) => {
    try {
      setError(null);

      // For demo/development, use mock device
      if (deviceType === 'mock' || true) { // Always use mock for now
        const result = await wearablesAPI.connectMockDevice(deviceType);

        if (result.success) {
          setSuccess(`Demo ${deviceType.replace('_', ' ')} connected! Syncing data...`);

          // Auto-sync after connection
          setTimeout(async () => {
            try {
              await wearablesAPI.syncDevice(result.data.connection.connection_id, 14);
              setSuccess(`${deviceType.replace('_', ' ')} synced successfully!`);
              loadData();
            } catch (syncErr) {
              console.error('Sync error:', syncErr);
            }
          }, 500);

          loadData();
        }
      } else {
        // Real OAuth flow
        const result = await wearablesAPI.initiateConnection(deviceType);
        if (result.data?.authUrl) {
          window.location.href = result.data.authUrl;
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(`Failed to connect ${deviceType}. Please try again.`);
    }
  };

  // Handle device disconnect
  const handleDisconnect = async (connectionId) => {
    try {
      setError(null);
      await wearablesAPI.disconnectDevice(connectionId);
      setSuccess('Device disconnected successfully.');
      loadData();
    } catch (err) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect device. Please try again.');
    }
  };

  // Handle manual sync
  const handleSync = async (connectionId) => {
    try {
      setError(null);
      await wearablesAPI.syncDevice(connectionId, 7);
      setSuccess('Data synced successfully!');
      loadData();
    } catch (err) {
      console.error('Sync error:', err);
      setError('Failed to sync data. Please try again.');
    }
  };

  // Calculate correlations
  const handleCalculateCorrelations = async () => {
    try {
      setError(null);
      setSuccess(null);
      const result = await wearablesAPI.calculateCorrelations(30, true);

      if (result.success && result.data.success) {
        setSuccess(`Found ${result.data.significantCorrelations} significant correlations!`);
        setCorrelations(await (await wearablesAPI.getCorrelations()).data);
        setInsights(await (await wearablesAPI.getInsights(false, 20)).data);
      } else {
        setError(result.data?.message || 'Not enough data for correlation analysis yet.');
      }
    } catch (err) {
      console.error('Correlation error:', err);
      setError('Failed to calculate correlations. Please try again.');
    }
  };

  // Mark insight as read
  const handleMarkInsightRead = async (insightId) => {
    try {
      await wearablesAPI.markInsightRead(insightId);
      setInsights(prev => prev.map(i =>
        i.insight_id === insightId ? { ...i, is_read: true } : i
      ));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  // Refresh insights
  const handleRefreshInsights = async () => {
    try {
      const result = await wearablesAPI.generateInsights();
      if (result.success) {
        setInsights(await (await wearablesAPI.getInsights(false, 20)).data);
        setSuccess(`Generated ${result.data.insightsGenerated} new insights!`);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const connectedCount = connections.filter(c => c.is_active).length;

  // Tab styles
  const tabStyle = (isActive) => ({
    padding: 'var(--spacing-md) var(--spacing-lg)',
    border: 'none',
    background: 'none',
    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
    borderBottom: isActive ? '2px solid var(--primary-color)' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    transition: 'all var(--transition-base)'
  });

  return (
    <>
      <Navigation />
      <main id="main-content" className="container" style={{
        maxWidth: '1100px',
        paddingTop: 'var(--spacing-xl)',
        paddingBottom: 'var(--spacing-xxl)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <div>
            <h1 style={{
              fontSize: 'var(--font-size-xxl)',
              fontFamily: 'var(--font-family-heading)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              Wearable Devices
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Connect your wearables to discover how biometrics affect your mood
            </p>
          </div>
          {connectedCount > 0 && (
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--success-light)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--success-color)',
              fontSize: 'var(--font-size-small)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--success-color)'
              }} />
              {connectedCount} Connected
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--error-color)',
            marginBottom: 'var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)'
              }}
            >
              x
            </button>
          </div>
        )}

        {success && (
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success-color)',
            marginBottom: 'var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{success}</span>
            <button
              onClick={() => setSuccess(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)'
              }}
            >
              x
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-xs)',
          marginBottom: 'var(--spacing-xl)',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto'
        }}>
          <button style={tabStyle(activeTab === 'devices')} onClick={() => setActiveTab('devices')}>
            <span>Devices</span>
          </button>
          <button style={tabStyle(activeTab === 'data')} onClick={() => setActiveTab('data')}>
            <span>Biometrics</span>
          </button>
          <button style={tabStyle(activeTab === 'insights')} onClick={() => setActiveTab('insights')}>
            <span>Insights</span>
            {insights.filter(i => !i.is_read).length > 0 && (
              <span style={{
                fontSize: '0.65rem',
                background: 'var(--primary-color)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)'
              }}>
                {insights.filter(i => !i.is_read).length}
              </span>
            )}
          </button>
          <button style={tabStyle(activeTab === 'correlations')} onClick={() => setActiveTab('correlations')}>
            <span>Correlations</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-xxl)',
            color: 'var(--text-secondary)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary-color)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--spacing-md)'
            }} />
            Loading wearable data...
          </div>
        )}

        {/* Devices Tab */}
        {!loading && activeTab === 'devices' && (
          <WearableDeviceList
            devices={devices}
            connections={connections}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
          />
        )}

        {/* Biometrics Tab */}
        {!loading && activeTab === 'data' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            <BiometricSummaryCard biometrics={biometrics} loading={false} />

            {connectedCount === 0 && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--spacing-xl)',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-md)', opacity: 0.5 }}></div>
                <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}>
                  No devices connected
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                  Connect a wearable device to start tracking your biometrics
                </p>
                <button
                  onClick={() => setActiveTab('devices')}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    background: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Connect Device
                </button>
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {!loading && activeTab === 'insights' && (
          <BiometricInsights
            insights={insights}
            loading={false}
            onMarkRead={handleMarkInsightRead}
            onRefresh={handleRefreshInsights}
          />
        )}

        {/* Correlations Tab */}
        {!loading && activeTab === 'correlations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            <CorrelationDisplay correlations={correlations} loading={false} />

            <div style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--spacing-xl)',
              boxShadow: 'var(--shadow-sm)',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                marginBottom: 'var(--spacing-sm)'
              }}>
                Analyze Your Data
              </h3>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--font-size-small)'
              }}>
                Calculate correlations between your biometric data and mood entries.
                Requires at least 7 days of both mood and biometric data.
              </p>
              <button
                onClick={handleCalculateCorrelations}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-xl)',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 'var(--font-size-base)'
                }}
              >
                Calculate Correlations
              </button>
            </div>

            {/* Info card about correlations */}
            <div style={{
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--spacing-xl)',
              borderLeft: '4px solid var(--primary-color)'
            }}>
              <h4 style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                marginBottom: 'var(--spacing-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <span></span>
                Understanding Correlations
              </h4>
              <p style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                Correlations help identify relationships between your biometrics and mood.
                A <strong>positive correlation</strong> means both values tend to increase together.
                A <strong>negative correlation</strong> means when one increases, the other tends to decrease.
                Correlations range from -1 to +1, with values closer to these extremes indicating stronger relationships.
              </p>
            </div>
          </div>
        )}

        {/* Spin animation keyframe */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </>
  );
};

export default WearableSettings;
