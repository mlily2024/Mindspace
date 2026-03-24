import React, { useState } from 'react';
import { wearablesAPI } from '../services/api';

/**
 * WearableCard - Individual wearable device card for connection management
 */
const WearableCard = ({ device, connection, onConnect, onDisconnect, onSync }) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isConnected = connection?.is_active;
  const lastSync = connection?.last_sync_at;
  const syncStatus = connection?.sync_status;

  // Device icons and colors
  const deviceConfig = {
    apple_health: { icon: '', name: 'Apple Health', color: '#FF2D55' },
    oura: { icon: '', name: 'Oura Ring', color: '#8B5CF6' },
    fitbit: { icon: '', name: 'Fitbit', color: '#00B0B9' },
    garmin: { icon: '', name: 'Garmin', color: '#007CC3' },
    mock: { icon: '', name: 'Demo Device', color: '#6B7280' }
  };

  const config = deviceConfig[device.deviceType] || deviceConfig.mock;

  const handleConnect = async () => {
    setLoading(true);
    try {
      await onConnect(device.deviceType);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setLoading(true);
    try {
      await onDisconnect(connection.connection_id);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!connection) return;
    setSyncing(true);
    try {
      await onSync(connection.connection_id);
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSyncStatusBadge = (status) => {
    const statusConfig = {
      success: { color: 'var(--success-color)', bg: 'rgba(34, 197, 94, 0.1)', text: 'Synced' },
      syncing: { color: 'var(--primary-color)', bg: 'rgba(99, 102, 241, 0.1)', text: 'Syncing...' },
      pending: { color: 'var(--warning-color)', bg: 'rgba(245, 158, 11, 0.1)', text: 'Pending' },
      failed: { color: 'var(--error-color)', bg: 'rgba(239, 68, 68, 0.1)', text: 'Failed' },
      disconnected: { color: 'var(--text-secondary)', bg: 'var(--background)', text: 'Disconnected' }
    };

    const cfg = statusConfig[status] || statusConfig.pending;

    return (
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 500,
        color: cfg.color,
        background: cfg.bg,
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        display: 'inline-block'
      }}>
        {cfg.text}
      </span>
    );
  };

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    boxShadow: 'var(--shadow-sm)',
    border: isConnected ? `2px solid ${config.color}40` : '2px solid transparent',
    transition: 'all var(--transition-base)',
    position: 'relative',
    overflow: 'hidden'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-md)'
  };

  const iconContainerStyle = {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    background: `${config.color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem'
  };

  const deviceInfoStyle = {
    flex: 1
  };

  const deviceNameStyle = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px'
  };

  const deviceDescStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)'
  };

  const statusContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-md)',
    padding: 'var(--spacing-sm)',
    background: 'var(--background)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-small)'
  };

  const capabilitiesStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--spacing-xs)',
    marginBottom: 'var(--spacing-md)'
  };

  const capabilityBadgeStyle = {
    fontSize: '0.7rem',
    padding: '2px 8px',
    background: 'var(--background)',
    borderRadius: 'var(--radius-full)',
    color: 'var(--text-secondary)'
  };

  const actionsStyle = {
    display: 'flex',
    gap: 'var(--spacing-sm)'
  };

  const buttonStyle = (primary = false) => ({
    flex: 1,
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? config.color : 'transparent',
    color: primary ? 'white' : 'var(--text-primary)',
    fontSize: 'var(--font-size-small)',
    fontWeight: 500,
    cursor: loading || syncing ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-base)',
    opacity: loading || syncing ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-xs)'
  });

  const capabilities = device.capabilities || ['sleep', 'hrv', 'activity'];

  return (
    <div style={cardStyle}>
      {/* Connection indicator bar */}
      {isConnected && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: config.color
        }} />
      )}

      <div style={headerStyle}>
        <div style={iconContainerStyle}>
          {config.icon}
        </div>
        <div style={deviceInfoStyle}>
          <div style={deviceNameStyle}>{device.name || config.name}</div>
          <div style={deviceDescStyle}>
            {device.description || 'Health & fitness tracking'}
          </div>
        </div>
      </div>

      {isConnected && (
        <div style={statusContainerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Last sync:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {formatLastSync(lastSync)}
            </span>
          </div>
          {getSyncStatusBadge(syncing ? 'syncing' : syncStatus)}
        </div>
      )}

      <div style={capabilitiesStyle}>
        {capabilities.map((cap, index) => (
          <span key={index} style={capabilityBadgeStyle}>
            {cap === 'sleep' && 'Sleep'}
            {cap === 'hrv' && 'HRV'}
            {cap === 'heart_rate' && 'Heart Rate'}
            {cap === 'activity' && 'Activity'}
            {cap === 'steps' && 'Steps'}
            {cap === 'stress' && 'Stress'}
            {cap === 'spo2' && 'SpO2'}
            {cap === 'readiness' && 'Readiness'}
          </span>
        ))}
      </div>

      <div style={actionsStyle}>
        {isConnected ? (
          <>
            <button
              style={buttonStyle(true)}
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              style={buttonStyle(false)}
              onClick={handleDisconnect}
              disabled={loading}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            style={buttonStyle(true)}
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * WearableDeviceList - Grid of available wearable devices
 */
export const WearableDeviceList = ({ devices, connections, onConnect, onDisconnect, onSync }) => {
  const getConnectionForDevice = (deviceType) => {
    return connections?.find(c => c.device_type === deviceType && c.is_active);
  };

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 'var(--spacing-lg)'
  };

  const headerStyle = {
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    marginBottom: 'var(--spacing-xs)'
  };

  const subtitleStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)'
  };

  const connectedCount = connections?.filter(c => c.is_active).length || 0;

  return (
    <div>
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <span style={{ fontSize: '1.2rem' }}></span>
          Connected Devices
        </h2>
        <p style={subtitleStyle}>
          {connectedCount > 0
            ? `${connectedCount} device${connectedCount > 1 ? 's' : ''} connected`
            : 'Connect your wearable devices to track biometrics'}
        </p>
      </div>

      <div style={containerStyle}>
        {devices?.map((device) => (
          <WearableCard
            key={device.deviceType}
            device={device}
            connection={getConnectionForDevice(device.deviceType)}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSync={onSync}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * BiometricSummaryCard - Quick overview of latest biometric readings
 */
export const BiometricSummaryCard = ({ biometrics, loading }) => {
  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: 'var(--spacing-md)'
  };

  const metricStyle = {
    textAlign: 'center',
    padding: 'var(--spacing-md)',
    background: 'var(--background)',
    borderRadius: 'var(--radius-lg)'
  };

  const metricValueStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px'
  };

  const metricLabelStyle = {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const metricIconStyle = {
    fontSize: '1.2rem',
    marginBottom: '4px'
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
          Loading biometrics...
        </div>
      </div>
    );
  }

  if (!biometrics || biometrics.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>Latest Readings</span>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
          No biometric data yet. Connect a device and sync to see your metrics.
        </div>
      </div>
    );
  }

  // Map biometric types to display info
  const metricDisplay = {
    sleep_duration: { icon: '', label: 'Sleep', unit: 'hrs' },
    sleep_quality: { icon: '', label: 'Sleep Quality', unit: '%' },
    hrv: { icon: '', label: 'HRV', unit: 'ms' },
    hrv_rmssd: { icon: '', label: 'HRV RMSSD', unit: 'ms' },
    resting_heart_rate: { icon: '', label: 'Resting HR', unit: 'bpm' },
    steps: { icon: '', label: 'Steps', unit: '' },
    active_minutes: { icon: '', label: 'Active', unit: 'min' },
    activity_score: { icon: '', label: 'Activity', unit: '' },
    readiness_score: { icon: '', label: 'Readiness', unit: '' },
    stress_level: { icon: '', label: 'Stress', unit: '' }
  };

  // Get latest value for each type
  const latestByType = {};
  biometrics.forEach(b => {
    if (!latestByType[b.data_type] || new Date(b.recorded_at) > new Date(latestByType[b.data_type].recorded_at)) {
      latestByType[b.data_type] = b;
    }
  });

  const displayMetrics = Object.entries(latestByType).slice(0, 6);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <span>Latest Readings</span>
        </h3>
      </div>

      <div style={gridStyle}>
        {displayMetrics.map(([type, data]) => {
          const display = metricDisplay[type] || { icon: '', label: type, unit: '' };
          const value = parseFloat(data.value_numeric);
          const formattedValue = value >= 1000 ? `${(value/1000).toFixed(1)}k` :
                                  value >= 100 ? Math.round(value) :
                                  value.toFixed(1);

          return (
            <div key={type} style={metricStyle}>
              <div style={metricIconStyle}>{display.icon}</div>
              <div style={metricValueStyle}>
                {formattedValue}
                {display.unit && <span style={{ fontSize: '0.6rem', fontWeight: 400 }}> {display.unit}</span>}
              </div>
              <div style={metricLabelStyle}>{display.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WearableCard;
