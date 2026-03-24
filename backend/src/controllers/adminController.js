const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const bcrypt = require('bcryptjs');

/**
 * Admin Controller - Developer Panel Features
 */

/**
 * Get all users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const query = `
      SELECT
        u.user_id, u.email, u.username, u.is_anonymous, u.user_group,
        u.created_at, u.last_login, u.account_status,
        (SELECT COUNT(*) FROM mood_entries WHERE user_id = u.user_id) as mood_entries_count
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `SELECT COUNT(*) FROM users`;

    const [result, countResult] = await Promise.all([
      db.query(query, [limit, offset]),
      db.query(countQuery)
    ]);

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error('Admin: Get all users error', { error: error.message });
    next(error);
  }
};

/**
 * Get all mood entries
 */
const getAllMoodEntries = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const query = `
      SELECT
        m.*,
        u.username, u.email, u.user_group
      FROM mood_entries m
      LEFT JOIN users u ON m.user_id = u.user_id
      ORDER BY m.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `SELECT COUNT(*) FROM mood_entries`;

    const [entries, countResult] = await Promise.all([
      db.query(query, [limit, offset]),
      db.query(countQuery)
    ]);

    res.json({
      success: true,
      data: {
        entries: entries.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Admin: Get all mood entries error', { error: error.message });
    next(error);
  }
};

/**
 * Get database statistics
 */
const getDatabaseStats = async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE account_status = 'active') as active_users,
        (SELECT COUNT(*) FROM users WHERE is_anonymous = true) as anonymous_users,
        (SELECT COUNT(*) FROM mood_entries) as total_mood_entries,
        (SELECT COUNT(*) FROM user_insights) as total_insights,
        (SELECT COUNT(*) FROM recommendations) as total_recommendations,
        (SELECT COUNT(*) FROM safety_alerts) as total_safety_alerts,
        (SELECT COUNT(*) FROM safety_alerts WHERE is_acknowledged = false) as unacknowledged_alerts,
        (SELECT AVG(mood_score) FROM mood_entries) as avg_mood_score,
        (SELECT AVG(stress_level) FROM mood_entries) as avg_stress_level,
        (SELECT COUNT(*) FROM mood_entries WHERE created_at > NOW() - INTERVAL '24 hours') as entries_last_24h,
        (SELECT COUNT(*) FROM mood_entries WHERE created_at > NOW() - INTERVAL '7 days') as entries_last_7d,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_last_7d
    `;

    const userGroupQuery = `
      SELECT user_group, COUNT(*) as count
      FROM users
      WHERE user_group IS NOT NULL
      GROUP BY user_group
    `;

    const [stats, userGroups] = await Promise.all([
      db.query(statsQuery),
      db.query(userGroupQuery)
    ]);

    res.json({
      success: true,
      data: {
        statistics: stats.rows[0],
        userGroups: userGroups.rows,
        serverTime: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    logger.error('Admin: Get database stats error', { error: error.message });
    next(error);
  }
};

/**
 * Manage user - activate/deactivate
 */
const manageUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'activate', 'deactivate', 'suspend'

    const validActions = ['activate', 'deactivate', 'suspend'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use: activate, deactivate, or suspend'
      });
    }

    const statusMap = {
      activate: 'active',
      deactivate: 'inactive',
      suspend: 'suspended'
    };

    const query = `
      UPDATE users
      SET account_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING user_id, email, username, account_status
    `;

    const result = await db.query(query, [statusMap[action], userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('Admin: User status changed', { userId, action, newStatus: statusMap[action] });

    res.json({
      success: true,
      message: `User ${action}d successfully`,
      data: { user: result.rows[0] }
    });
  } catch (error) {
    logger.error('Admin: Manage user error', { error: error.message });
    next(error);
  }
};

/**
 * View system logs
 */
const getSystemLogs = async (req, res, next) => {
  try {
    const type = req.query.type === 'error' ? 'error' : 'combined';
    const lines = Math.min(Math.max(parseInt(req.query.lines) || 100, 1), 1000);

    const logDir = path.join(__dirname, '../../logs');
    const logFile = type === 'error' ? 'error.log' : 'combined.log';
    const logPath = path.join(logDir, logFile);

    let logs = [];

    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      logs = allLines.slice(-parseInt(lines)).reverse();
    }

    // Also get recent audit logs from database
    const auditQuery = `
      SELECT * FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const auditLogs = await db.query(auditQuery, [lines]);

    res.json({
      success: true,
      data: {
        fileLogs: logs,
        auditLogs: auditLogs.rows,
        logFile: logFile,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Admin: Get system logs error', { error: error.message });
    next(error);
  }
};

/**
 * Generate test data
 */
const generateTestData = async (req, res, next) => {
  try {
    const {
      userCount = 5,
      entriesPerUser = 10,
      includeInsights = true,
      includeRecommendations = true
    } = req.body;

    const createdUsers = [];
    const createdEntries = [];

    // Generate proper password hash for test users
    const testPassword = 'testpass123';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Generate test users
    for (let i = 0; i < userCount; i++) {
      const userId = uuidv4();
      const userGroups = ['student', 'professional', 'parent', 'elderly'];
      const randomGroup = userGroups[Math.floor(Math.random() * userGroups.length)];

      const userQuery = `
        INSERT INTO users (user_id, email, username, password_hash, user_group, is_anonymous)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING user_id, email, username, user_group
      `;

      const userResult = await db.query(userQuery, [
        userId,
        `testuser${i + 1}_${Date.now()}@test.com`,
        `TestUser${i + 1}_${Date.now().toString().slice(-4)}`,
        passwordHash,
        randomGroup
      ]);

      createdUsers.push(userResult.rows[0]);

      // Create preferences for user
      await db.query(`INSERT INTO user_preferences (user_id) VALUES ($1)`, [userId]);

      // Generate mood entries for this user
      for (let j = 0; j < entriesPerUser; j++) {
        const entryId = uuidv4();
        const daysAgo = Math.floor(Math.random() * 30);

        const entryQuery = `
          INSERT INTO mood_entries (
            entry_id, user_id, entry_date, entry_time,
            mood_score, energy_level, stress_level, sleep_quality,
            sleep_hours, anxiety_level, social_interaction_quality
          )
          VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day' * $3, CURRENT_TIME, $4, $5, $6, $7, $8, $9, $10)
          RETURNING entry_id
        `;

        const entryResult = await db.query(entryQuery, [
          entryId,
          userId,
          daysAgo,
          Math.floor(Math.random() * 10) + 1, // mood 1-10
          Math.floor(Math.random() * 10) + 1, // energy 1-10
          Math.floor(Math.random() * 10) + 1, // stress 1-10
          Math.floor(Math.random() * 10) + 1, // sleep quality 1-10
          (Math.random() * 6 + 4).toFixed(1), // sleep hours 4-10
          Math.floor(Math.random() * 10) + 1, // anxiety 1-10
          Math.floor(Math.random() * 10) + 1  // social 1-10
        ]);

        createdEntries.push(entryResult.rows[0]);
      }

      // Generate insights if requested
      if (includeInsights) {
        const insightId = uuidv4();
        const insightTypes = ['trend', 'pattern', 'improvement', 'recommendation'];
        const severities = ['low', 'moderate', 'high'];

        await db.query(`
          INSERT INTO user_insights (insight_id, user_id, insight_type, insight_period, insight_data, severity)
          VALUES ($1, $2, $3, 'weekly', $4, $5)
        `, [
          insightId,
          userId,
          insightTypes[Math.floor(Math.random() * insightTypes.length)],
          JSON.stringify({ title: 'Test Insight', description: 'This is a test insight generated for development.' }),
          severities[Math.floor(Math.random() * severities.length)]
        ]);
      }

      // Generate recommendations if requested
      if (includeRecommendations) {
        const recId = uuidv4();
        const recTypes = ['activity', 'breathing', 'exercise', 'social', 'rest'];

        await db.query(`
          INSERT INTO recommendations (recommendation_id, user_id, recommendation_type, title, description, effort_level, estimated_duration)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          recId,
          userId,
          recTypes[Math.floor(Math.random() * recTypes.length)],
          'Test Recommendation',
          'This is a test recommendation generated for development.',
          ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          [5, 10, 15, 30][Math.floor(Math.random() * 4)]
        ]);
      }
    }

    logger.info('Admin: Test data generated', {
      usersCreated: createdUsers.length,
      entriesCreated: createdEntries.length
    });

    res.json({
      success: true,
      message: 'Test data generated successfully',
      data: {
        usersCreated: createdUsers.length,
        entriesCreated: createdEntries.length,
        users: createdUsers
      }
    });
  } catch (error) {
    logger.error('Admin: Generate test data error', { error: error.message });
    next(error);
  }
};

/**
 * Delete test data (cleanup)
 */
const deleteTestData = async (req, res, next) => {
  try {
    const deleteQuery = `
      DELETE FROM users
      WHERE email LIKE 'testuser%@test.com'
      RETURNING user_id
    `;

    const result = await db.query(deleteQuery);

    logger.info('Admin: Test data deleted', { usersDeleted: result.rows.length });

    res.json({
      success: true,
      message: 'Test data deleted successfully',
      data: {
        usersDeleted: result.rows.length
      }
    });
  } catch (error) {
    logger.error('Admin: Delete test data error', { error: error.message });
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getAllMoodEntries,
  getDatabaseStats,
  manageUser,
  getSystemLogs,
  generateTestData,
  deleteTestData
};
