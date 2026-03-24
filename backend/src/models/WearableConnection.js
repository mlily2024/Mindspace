const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * WearableConnection Model
 * Handles wearable device connections and biometric data storage
 * OAuth tokens are encrypted at rest using AES-256
 */
class WearableConnection {
  /**
   * Encrypt OAuth tokens before storage
   */
  static encryptTokens(accessToken, refreshToken) {
    return {
      accessToken: accessToken ? encrypt(accessToken) : null,
      refreshToken: refreshToken ? encrypt(refreshToken) : null
    };
  }

  /**
   * Decrypt OAuth tokens after retrieval
   */
  static decryptTokens(row) {
    if (!row) return row;
    try {
      if (row.access_token) {
        row.access_token = decrypt(row.access_token);
      }
      if (row.refresh_token) {
        row.refresh_token = decrypt(row.refresh_token);
      }
    } catch (err) {
      // Log error but don't expose details
      console.error('Token decryption failed for connection:', row.connection_id);
      row.access_token = null;
      row.refresh_token = null;
    }
    return row;
  }
  // ===========================================
  // CONNECTION MANAGEMENT
  // ===========================================

  /**
   * Create a new wearable connection
   * Encrypts OAuth tokens before storage
   */
  static async create(userId, { deviceType, deviceName, accessToken, refreshToken, tokenExpiresAt, permissionsGranted }) {
    const connectionId = uuidv4();

    // Encrypt OAuth tokens before storage
    const encryptedTokens = this.encryptTokens(accessToken, refreshToken);

    const query = `
      INSERT INTO wearable_connections (
        connection_id, user_id, device_type, device_name,
        access_token, refresh_token, token_expires_at,
        permissions_granted, sync_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      ON CONFLICT (user_id, device_type)
      DO UPDATE SET
        device_name = EXCLUDED.device_name,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        permissions_granted = EXCLUDED.permissions_granted,
        sync_status = 'pending',
        is_active = TRUE,
        error_message = NULL,
        error_count = 0,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      connectionId,
      userId,
      deviceType,
      deviceName || deviceType,
      encryptedTokens.accessToken,
      encryptedTokens.refreshToken,
      tokenExpiresAt,
      JSON.stringify(permissionsGranted || [])
    ];

    const result = await db.query(query, values);
    // Return without decrypting since caller likely doesn't need tokens immediately
    return result.rows[0];
  }

  /**
   * Get all active connections for a user
   */
  static async getUserConnections(userId) {
    const query = `
      SELECT
        connection_id, device_type, device_name,
        last_sync_at, sync_status, sync_frequency_hours,
        permissions_granted, is_active, error_message,
        created_at, updated_at
      FROM wearable_connections
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get a specific connection
   * Decrypts OAuth tokens for API use
   */
  static async getById(connectionId, userId) {
    const query = `
      SELECT * FROM wearable_connections
      WHERE connection_id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [connectionId, userId]);
    return this.decryptTokens(result.rows[0]);
  }

  /**
   * Get connection by device type
   * Decrypts OAuth tokens for API use
   */
  static async getByDeviceType(userId, deviceType) {
    const query = `
      SELECT * FROM wearable_connections
      WHERE user_id = $1 AND device_type = $2 AND is_active = TRUE
    `;

    const result = await db.query(query, [userId, deviceType]);
    return this.decryptTokens(result.rows[0]);
  }

  /**
   * Update connection tokens (for OAuth refresh)
   * Encrypts new tokens before storage
   */
  static async updateTokens(connectionId, { accessToken, refreshToken, tokenExpiresAt }) {
    // Encrypt the new tokens
    const encryptedTokens = this.encryptTokens(accessToken, refreshToken);

    const query = `
      UPDATE wearable_connections
      SET
        access_token = $2,
        refresh_token = COALESCE($3, refresh_token),
        token_expires_at = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [
      connectionId,
      encryptedTokens.accessToken,
      encryptedTokens.refreshToken,
      tokenExpiresAt
    ]);
    return result.rows[0];
  }

  /**
   * Update sync status
   */
  static async updateSyncStatus(connectionId, status, errorMessage = null) {
    const query = `
      UPDATE wearable_connections
      SET
        sync_status = $2,
        last_sync_at = CASE WHEN $2 = 'success' THEN CURRENT_TIMESTAMP ELSE last_sync_at END,
        error_message = $3,
        error_count = CASE WHEN $3 IS NOT NULL THEN error_count + 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [connectionId, status, errorMessage]);
    return result.rows[0];
  }

  /**
   * Disconnect a wearable device
   */
  static async disconnect(connectionId, userId) {
    const query = `
      UPDATE wearable_connections
      SET
        is_active = FALSE,
        sync_status = 'disconnected',
        access_token = NULL,
        refresh_token = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = $1 AND user_id = $2
      RETURNING connection_id, device_type
    `;

    const result = await db.query(query, [connectionId, userId]);
    return result.rows[0];
  }

  /**
   * Get connections that need syncing
   * Decrypts OAuth tokens for API use
   */
  static async getConnectionsDueForSync() {
    const query = `
      SELECT * FROM wearable_connections
      WHERE is_active = TRUE
        AND sync_status != 'syncing'
        AND (
          last_sync_at IS NULL
          OR last_sync_at < NOW() - (sync_frequency_hours || ' hours')::INTERVAL
        )
        AND error_count < 5
      ORDER BY last_sync_at ASC NULLS FIRST
      LIMIT 100
    `;

    const result = await db.query(query);
    // Decrypt tokens for each connection
    return result.rows.map(row => this.decryptTokens(row));
  }

  // ===========================================
  // BIOMETRIC DATA OPERATIONS
  // ===========================================

  /**
   * Save biometric data
   */
  static async saveBiometricData(userId, connectionId, dataEntries) {
    if (!dataEntries || dataEntries.length === 0) {
      return { inserted: 0 };
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const entry of dataEntries) {
      const dataId = uuidv4();
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10})`);
      values.push(
        dataId,
        userId,
        connectionId,
        entry.dataDate,
        entry.dataType,
        entry.valueNumeric,
        entry.valueJson ? JSON.stringify(entry.valueJson) : null,
        entry.unit || null,
        entry.source || null,
        entry.recordedAt || null,
        entry.qualityScore || null
      );
      paramIndex += 11;
    }

    const query = `
      INSERT INTO biometric_data (
        data_id, user_id, connection_id, data_date, data_type,
        value_numeric, value_json, unit, source, recorded_at, quality_score
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_id, data_date, data_type, source)
      DO UPDATE SET
        value_numeric = EXCLUDED.value_numeric,
        value_json = EXCLUDED.value_json,
        recorded_at = EXCLUDED.recorded_at,
        quality_score = EXCLUDED.quality_score
      RETURNING data_id
    `;

    const result = await db.query(query, values);
    return { inserted: result.rowCount };
  }

  /**
   * Get biometric data for a user
   */
  static async getBiometricData(userId, { startDate, endDate, dataTypes, limit = 100, offset = 0 }) {
    let query = `
      SELECT
        data_id, data_date, data_type, value_numeric, value_json,
        unit, source, recorded_at, quality_score, created_at
      FROM biometric_data
      WHERE user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND data_date >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND data_date <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    if (dataTypes && dataTypes.length > 0) {
      query += ` AND data_type = ANY($${paramCount})`;
      values.push(dataTypes);
      paramCount++;
    }

    query += ` ORDER BY data_date DESC, recorded_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Get biometric data summary for a date range
   */
  static async getBiometricSummary(userId, { startDate, endDate }) {
    const query = `
      SELECT
        data_type,
        COUNT(*) as data_points,
        AVG(value_numeric) as avg_value,
        MIN(value_numeric) as min_value,
        MAX(value_numeric) as max_value,
        STDDEV(value_numeric) as stddev_value,
        MIN(data_date) as first_date,
        MAX(data_date) as last_date
      FROM biometric_data
      WHERE user_id = $1
        AND data_date >= $2
        AND data_date <= $3
        AND value_numeric IS NOT NULL
      GROUP BY data_type
      ORDER BY data_type
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Get latest biometric values for each type
   */
  static async getLatestBiometrics(userId) {
    const query = `
      SELECT DISTINCT ON (data_type)
        data_type, value_numeric, value_json, data_date,
        recorded_at, source, quality_score
      FROM biometric_data
      WHERE user_id = $1
      ORDER BY data_type, data_date DESC, recorded_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // ===========================================
  // CORRELATION OPERATIONS
  // ===========================================

  /**
   * Save or update biometric-mood correlation
   */
  static async saveCorrelation(userId, correlationData) {
    const correlationId = uuidv4();

    const query = `
      INSERT INTO biometric_correlations (
        correlation_id, user_id, biometric_type, mood_metric,
        pearson_coefficient, p_value, sample_size,
        correlation_strength, direction, confidence_level,
        date_range_start, date_range_end, is_significant, insights_generated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id, biometric_type, mood_metric)
      DO UPDATE SET
        pearson_coefficient = EXCLUDED.pearson_coefficient,
        p_value = EXCLUDED.p_value,
        sample_size = EXCLUDED.sample_size,
        correlation_strength = EXCLUDED.correlation_strength,
        direction = EXCLUDED.direction,
        confidence_level = EXCLUDED.confidence_level,
        date_range_start = EXCLUDED.date_range_start,
        date_range_end = EXCLUDED.date_range_end,
        is_significant = EXCLUDED.is_significant,
        insights_generated = EXCLUDED.insights_generated,
        calculated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      correlationId,
      userId,
      correlationData.biometricType,
      correlationData.moodMetric,
      correlationData.pearsonCoefficient,
      correlationData.pValue,
      correlationData.sampleSize,
      correlationData.correlationStrength,
      correlationData.direction,
      correlationData.confidenceLevel,
      correlationData.dateRangeStart,
      correlationData.dateRangeEnd,
      correlationData.isSignificant,
      JSON.stringify(correlationData.insightsGenerated || [])
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get correlations for a user
   */
  static async getCorrelations(userId, { significantOnly = false } = {}) {
    let query = `
      SELECT * FROM biometric_correlations
      WHERE user_id = $1
    `;

    if (significantOnly) {
      query += ` AND is_significant = TRUE`;
    }

    query += ` ORDER BY ABS(pearson_coefficient) DESC`;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // ===========================================
  // BIOMETRIC INSIGHTS
  // ===========================================

  /**
   * Save a biometric insight
   */
  static async saveInsight(userId, insightData) {
    const insightId = uuidv4();

    const query = `
      INSERT INTO biometric_insights (
        insight_id, user_id, insight_type, title, description,
        biometric_type, impact_score, confidence_score,
        supporting_data, recommendations, is_actionable, priority, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      insightId,
      userId,
      insightData.insightType,
      insightData.title,
      insightData.description,
      insightData.biometricType,
      insightData.impactScore,
      insightData.confidenceScore,
      JSON.stringify(insightData.supportingData || {}),
      JSON.stringify(insightData.recommendations || []),
      insightData.isActionable !== false,
      insightData.priority || 1,
      insightData.expiresAt || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get insights for a user
   */
  static async getInsights(userId, { unreadOnly = false, limit = 10 } = {}) {
    let query = `
      SELECT * FROM biometric_insights
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;

    if (unreadOnly) {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY priority DESC, generated_at DESC LIMIT $2`;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Mark insight as read
   */
  static async markInsightRead(insightId, userId) {
    const query = `
      UPDATE biometric_insights
      SET is_read = TRUE, acknowledged_at = CURRENT_TIMESTAMP
      WHERE insight_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [insightId, userId]);
    return result.rows[0];
  }

  // ===========================================
  // BASELINES
  // ===========================================

  /**
   * Update or create biometric baseline
   */
  static async updateBaseline(userId, biometricType, baselineData) {
    const baselineId = uuidv4();

    const query = `
      INSERT INTO biometric_baselines (
        baseline_id, user_id, biometric_type,
        baseline_mean, baseline_stddev, baseline_min, baseline_max,
        optimal_range_low, optimal_range_high, sample_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, biometric_type)
      DO UPDATE SET
        baseline_mean = EXCLUDED.baseline_mean,
        baseline_stddev = EXCLUDED.baseline_stddev,
        baseline_min = EXCLUDED.baseline_min,
        baseline_max = EXCLUDED.baseline_max,
        optimal_range_low = EXCLUDED.optimal_range_low,
        optimal_range_high = EXCLUDED.optimal_range_high,
        sample_count = EXCLUDED.sample_count,
        last_calculated = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      baselineId,
      userId,
      biometricType,
      baselineData.mean,
      baselineData.stddev,
      baselineData.min,
      baselineData.max,
      baselineData.optimalRangeLow,
      baselineData.optimalRangeHigh,
      baselineData.sampleCount
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get baselines for a user
   */
  static async getBaselines(userId) {
    const query = `
      SELECT * FROM biometric_baselines
      WHERE user_id = $1
      ORDER BY biometric_type
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // ===========================================
  // SYNC LOGGING
  // ===========================================

  /**
   * Log sync operation
   */
  static async logSync(connectionId, userId, logData) {
    const logId = uuidv4();

    const query = `
      INSERT INTO wearable_sync_logs (
        log_id, connection_id, user_id, sync_type, sync_status,
        records_synced, date_range_start, date_range_end,
        duration_ms, error_message, error_details, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      logId,
      connectionId,
      userId,
      logData.syncType || 'manual',
      logData.syncStatus,
      logData.recordsSynced || 0,
      logData.dateRangeStart,
      logData.dateRangeEnd,
      logData.durationMs,
      logData.errorMessage,
      logData.errorDetails ? JSON.stringify(logData.errorDetails) : null,
      logData.syncStatus !== 'started' ? new Date() : null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get sync history for a connection
   */
  static async getSyncHistory(connectionId, limit = 20) {
    const query = `
      SELECT * FROM wearable_sync_logs
      WHERE connection_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [connectionId, limit]);
    return result.rows;
  }
}

module.exports = WearableConnection;
