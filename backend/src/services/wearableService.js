const WearableConnection = require('../models/WearableConnection');
const { getMockProvider, shouldUseMock } = require('./mockWearableProviders');
const logger = require('../config/logger');

/**
 * Wearable Service
 * Manages OAuth flows, data synchronization, and wearable connections
 */
class WearableService {
  /**
   * Supported device types
   */
  static DEVICE_TYPES = ['apple_health', 'oura', 'fitbit', 'garmin', 'mock'];

  /**
   * Device display information
   */
  static DEVICE_INFO = {
    apple_health: {
      name: 'Apple Health',
      icon: '🍎',
      color: '#FF2D55',
      description: 'Connect to Apple Health for sleep, activity, and heart data',
      capabilities: ['sleep', 'hrv', 'heart_rate', 'steps', 'activity', 'respiratory']
    },
    oura: {
      name: 'Oura Ring',
      icon: '💍',
      color: '#1DB954',
      description: 'Connect to Oura for sleep quality, readiness, and HRV data',
      capabilities: ['sleep', 'hrv', 'readiness', 'activity', 'temperature', 'spo2']
    },
    fitbit: {
      name: 'Fitbit',
      icon: '⌚',
      color: '#00B0B9',
      description: 'Connect to Fitbit for comprehensive health and fitness data',
      capabilities: ['sleep', 'hrv', 'heart_rate', 'steps', 'activity', 'stress', 'spo2']
    },
    garmin: {
      name: 'Garmin',
      icon: '🏃',
      color: '#007CC3',
      description: 'Connect to Garmin for training and recovery metrics',
      capabilities: ['sleep', 'hrv', 'heart_rate', 'steps', 'activity', 'stress']
    },
    mock: {
      name: 'Demo Device',
      icon: '🔧',
      color: '#9B8AA5',
      description: 'Test wearable integration with simulated data',
      capabilities: ['sleep', 'hrv', 'heart_rate', 'steps', 'activity']
    }
  };

  // ===========================================
  // CONNECTION MANAGEMENT
  // ===========================================

  /**
   * Initiate OAuth connection to a wearable device
   */
  static async initiateConnection(userId, deviceType) {
    // Validate device type
    if (!this.DEVICE_TYPES.includes(deviceType)) {
      throw new Error(`Unsupported device type: ${deviceType}`);
    }

    // Check if connection already exists
    const existingConnection = await WearableConnection.getByDeviceType(userId, deviceType);
    if (existingConnection && existingConnection.is_active) {
      return {
        success: true,
        message: 'Device already connected',
        connection: this.sanitizeConnection(existingConnection),
        alreadyConnected: true
      };
    }

    // For mock/development mode, simulate OAuth
    if (shouldUseMock() || deviceType === 'mock') {
      return await this.connectMockDevice(userId, deviceType);
    }

    // For real OAuth, generate authorization URL
    // In production, this would return a redirect URL
    const authUrl = this.generateAuthUrl(deviceType, userId);

    return {
      success: true,
      message: 'Authorization required',
      authUrl,
      deviceType,
      deviceInfo: this.DEVICE_INFO[deviceType]
    };
  }

  /**
   * Connect using mock provider (for development/testing)
   */
  static async connectMockDevice(userId, deviceType) {
    try {
      const provider = getMockProvider(deviceType === 'mock' ? 'apple_health' : deviceType);
      const authResult = await provider.authorize(userId);

      const connection = await WearableConnection.create(userId, {
        deviceType,
        deviceName: this.DEVICE_INFO[deviceType]?.name || deviceType,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiresAt: authResult.tokenExpiresAt,
        permissionsGranted: authResult.permissionsGranted
      });

      logger.info(`Wearable connected: ${deviceType}`, { userId, connectionId: connection.connection_id });

      // Trigger initial sync
      this.syncDeviceData(userId, connection.connection_id, deviceType).catch(err => {
        logger.error('Initial sync failed', { userId, deviceType, error: err.message });
      });

      return {
        success: true,
        message: 'Device connected successfully',
        connection: this.sanitizeConnection(connection),
        deviceInfo: this.DEVICE_INFO[deviceType]
      };
    } catch (error) {
      logger.error('Mock device connection failed', { userId, deviceType, error: error.message });
      throw error;
    }
  }

  /**
   * Handle OAuth callback (for real OAuth flows)
   */
  static async handleOAuthCallback(userId, deviceType, code, state) {
    // In production, exchange code for tokens
    // For now, use mock provider
    return await this.connectMockDevice(userId, deviceType);
  }

  /**
   * Disconnect a wearable device
   */
  static async disconnectDevice(userId, connectionId) {
    const connection = await WearableConnection.getById(connectionId, userId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // In production, revoke OAuth tokens with provider

    const result = await WearableConnection.disconnect(connectionId, userId);

    logger.info(`Wearable disconnected: ${connection.device_type}`, { userId, connectionId });

    return {
      success: true,
      message: 'Device disconnected successfully',
      deviceType: result.device_type
    };
  }

  /**
   * Get all connections for a user
   */
  static async getUserConnections(userId) {
    const connections = await WearableConnection.getUserConnections(userId);

    return connections.map(conn => ({
      ...this.sanitizeConnection(conn),
      deviceInfo: this.DEVICE_INFO[conn.device_type]
    }));
  }

  /**
   * Get available devices (not yet connected)
   */
  static async getAvailableDevices(userId) {
    const connections = await WearableConnection.getUserConnections(userId);
    const connectedTypes = connections.map(c => c.device_type);

    return this.DEVICE_TYPES
      .filter(type => !connectedTypes.includes(type))
      .map(type => ({
        deviceType: type,
        ...this.DEVICE_INFO[type]
      }));
  }

  // ===========================================
  // DATA SYNCHRONIZATION
  // ===========================================

  /**
   * Sync data from a specific device
   */
  static async syncDeviceData(userId, connectionId, deviceType, options = {}) {
    const startTime = Date.now();
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      syncType = 'manual'
    } = options;

    // Update status to syncing
    await WearableConnection.updateSyncStatus(connectionId, 'syncing');

    // Log sync start
    const syncLog = await WearableConnection.logSync(connectionId, userId, {
      syncType,
      syncStatus: 'started',
      dateRangeStart: startDate,
      dateRangeEnd: endDate
    });

    try {
      // Get provider and fetch data
      const provider = getMockProvider(deviceType === 'mock' ? 'apple_health' : deviceType);
      const data = await provider.fetchData(userId, startDate, endDate);

      // Save biometric data
      const saveResult = await WearableConnection.saveBiometricData(userId, connectionId, data);

      // Update connection status
      await WearableConnection.updateSyncStatus(connectionId, 'success');

      // Log success
      const durationMs = Date.now() - startTime;
      await WearableConnection.logSync(connectionId, userId, {
        syncType,
        syncStatus: 'success',
        recordsSynced: saveResult.inserted,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        durationMs
      });

      logger.info(`Wearable sync completed`, {
        userId,
        deviceType,
        recordsSynced: saveResult.inserted,
        durationMs
      });

      return {
        success: true,
        message: 'Data synced successfully',
        recordsSynced: saveResult.inserted,
        dateRange: { startDate, endDate },
        durationMs
      };
    } catch (error) {
      // Update status to failed
      await WearableConnection.updateSyncStatus(connectionId, 'failed', error.message);

      // Log failure
      await WearableConnection.logSync(connectionId, userId, {
        syncType,
        syncStatus: 'failed',
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
        errorDetails: { stack: error.stack }
      });

      logger.error('Wearable sync failed', { userId, deviceType, error: error.message });

      throw error;
    }
  }

  /**
   * Sync all connected devices for a user
   */
  static async syncAllDevices(userId) {
    const connections = await WearableConnection.getUserConnections(userId);

    const results = await Promise.allSettled(
      connections.map(conn =>
        this.syncDeviceData(userId, conn.connection_id, conn.device_type, { syncType: 'manual' })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: failed === 0,
      message: `Synced ${successful} devices, ${failed} failed`,
      results: results.map((r, i) => ({
        deviceType: connections[i].device_type,
        status: r.status,
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason.message : null
      }))
    };
  }

  // ===========================================
  // DATA RETRIEVAL
  // ===========================================

  /**
   * Get biometric data for a user
   */
  static async getBiometricData(userId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      dataTypes = null,
      limit = 100,
      offset = 0
    } = options;

    const data = await WearableConnection.getBiometricData(userId, {
      startDate,
      endDate,
      dataTypes,
      limit,
      offset
    });

    return {
      data,
      count: data.length,
      dateRange: { startDate, endDate }
    };
  }

  /**
   * Get biometric summary (aggregated stats)
   */
  static async getBiometricSummary(userId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0]
    } = options;

    const summary = await WearableConnection.getBiometricSummary(userId, { startDate, endDate });

    // Format summary with readable labels
    return summary.map(item => ({
      dataType: item.data_type,
      label: this.getDataTypeLabel(item.data_type),
      dataPoints: parseInt(item.data_points),
      average: item.avg_value ? parseFloat(item.avg_value).toFixed(2) : null,
      min: item.min_value ? parseFloat(item.min_value).toFixed(2) : null,
      max: item.max_value ? parseFloat(item.max_value).toFixed(2) : null,
      stdDev: item.stddev_value ? parseFloat(item.stddev_value).toFixed(2) : null,
      dateRange: {
        first: item.first_date,
        last: item.last_date
      }
    }));
  }

  /**
   * Get latest biometric values
   */
  static async getLatestBiometrics(userId) {
    const data = await WearableConnection.getLatestBiometrics(userId);

    return data.map(item => ({
      dataType: item.data_type,
      label: this.getDataTypeLabel(item.data_type),
      value: item.value_numeric,
      details: item.value_json,
      date: item.data_date,
      source: item.source,
      quality: item.quality_score
    }));
  }

  /**
   * Get sync history for a connection
   */
  static async getSyncHistory(userId, connectionId, limit = 20) {
    // Verify user owns this connection
    const connection = await WearableConnection.getById(connectionId, userId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    return await WearableConnection.getSyncHistory(connectionId, limit);
  }

  // ===========================================
  // BIOMETRIC INSIGHTS
  // ===========================================

  /**
   * Get biometric insights for a user
   */
  static async getInsights(userId, options = {}) {
    const { unreadOnly = false, limit = 10 } = options;
    return await WearableConnection.getInsights(userId, { unreadOnly, limit });
  }

  /**
   * Mark insight as read
   */
  static async markInsightRead(userId, insightId) {
    return await WearableConnection.markInsightRead(insightId, userId);
  }

  /**
   * Generate new insights based on biometric data
   */
  static async generateInsights(userId) {
    // This will be called by the BiometricCorrelationService
    // after calculating correlations
    const insights = [];

    // Get correlations
    const correlations = await WearableConnection.getCorrelations(userId, { significantOnly: true });

    for (const corr of correlations) {
      if (corr.is_significant && Math.abs(corr.pearson_coefficient) > 0.3) {
        const insight = this.generateCorrelationInsight(corr);
        if (insight) {
          const saved = await WearableConnection.saveInsight(userId, insight);
          insights.push(saved);
        }
      }
    }

    return insights;
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  /**
   * Remove sensitive data from connection object
   */
  static sanitizeConnection(connection) {
    const { access_token, refresh_token, token_expires_at, ...safe } = connection;
    return {
      ...safe,
      hasValidToken: token_expires_at ? new Date(token_expires_at) > new Date() : false
    };
  }

  /**
   * Generate OAuth authorization URL (placeholder for real implementation)
   */
  static generateAuthUrl(deviceType, userId) {
    // In production, this would generate real OAuth URLs
    const baseUrls = {
      apple_health: 'https://appleid.apple.com/auth/authorize',
      oura: 'https://cloud.ouraring.com/oauth/authorize',
      fitbit: 'https://www.fitbit.com/oauth2/authorize',
      garmin: 'https://connect.garmin.com/oauthConfirm'
    };

    const state = Buffer.from(JSON.stringify({ userId, deviceType })).toString('base64');
    const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/wearables/callback/${deviceType}`;

    return `${baseUrls[deviceType]}?response_type=code&client_id=PLACEHOLDER&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }

  /**
   * Get human-readable label for data type
   */
  static getDataTypeLabel(dataType) {
    const labels = {
      sleep_duration: 'Sleep Duration',
      sleep_quality: 'Sleep Quality',
      sleep_stages: 'Sleep Stages',
      hrv: 'Heart Rate Variability',
      hrv_rmssd: 'HRV (RMSSD)',
      hrv_sdnn: 'HRV (SDNN)',
      resting_heart_rate: 'Resting Heart Rate',
      heart_rate_variability: 'Heart Rate Variability',
      steps: 'Steps',
      active_minutes: 'Active Minutes',
      calories_burned: 'Calories Burned',
      activity_score: 'Activity Score',
      readiness_score: 'Readiness Score',
      stress_level: 'Stress Level',
      body_battery: 'Body Battery',
      respiratory_rate: 'Respiratory Rate',
      spo2: 'Blood Oxygen (SpO2)'
    };

    return labels[dataType] || dataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate insight from correlation data
   */
  static generateCorrelationInsight(correlation) {
    const { biometric_type, mood_metric, pearson_coefficient, correlation_strength, direction } = correlation;

    const biometricLabel = this.getDataTypeLabel(biometric_type);
    const moodLabel = mood_metric.replace(/_/g, ' ');

    let title, description, recommendations;

    if (direction === 'positive' && correlation_strength !== 'weak') {
      title = `${biometricLabel} positively affects your ${moodLabel}`;
      description = `We found a ${correlation_strength} positive correlation between your ${biometricLabel.toLowerCase()} and ${moodLabel}. When your ${biometricLabel.toLowerCase()} increases, your ${moodLabel} tends to improve.`;
      recommendations = [
        `Focus on improving your ${biometricLabel.toLowerCase()} for better ${moodLabel}`,
        `Track patterns to optimize your ${biometricLabel.toLowerCase()}`
      ];
    } else if (direction === 'negative' && correlation_strength !== 'weak') {
      title = `${biometricLabel} negatively affects your ${moodLabel}`;
      description = `We found a ${correlation_strength} negative correlation between your ${biometricLabel.toLowerCase()} and ${moodLabel}. Higher ${biometricLabel.toLowerCase()} is associated with lower ${moodLabel}.`;
      recommendations = [
        `Monitor your ${biometricLabel.toLowerCase()} levels`,
        `Consider adjustments to improve your ${moodLabel}`
      ];
    } else {
      return null; // Skip weak or non-significant correlations
    }

    return {
      insightType: 'correlation_discovery',
      title,
      description,
      biometricType: biometric_type,
      impactScore: Math.abs(pearson_coefficient),
      confidenceScore: Math.min(0.95, 0.5 + Math.abs(pearson_coefficient) * 0.5),
      supportingData: {
        correlation: pearson_coefficient,
        strength: correlation_strength,
        direction
      },
      recommendations,
      isActionable: true,
      priority: Math.abs(pearson_coefficient) > 0.5 ? 2 : 1,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
  }
}

module.exports = WearableService;
