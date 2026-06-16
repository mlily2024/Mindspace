const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('../utils/encryption');
const cache = require('../services/cacheService');

class MoodEntry {
  /**
   * Create a new mood entry
   */
  static async create(userId, entryData) {
    const entryId = uuidv4();
    const {
      moodScore,
      energyLevel,
      stressLevel,
      sleepQuality,
      sleepHours,
      anxietyLevel,
      socialInteractionQuality,
      notes,
      activities,
      triggers,
      // Phase 1.3 step 5+7 (ADR-0009): when TRUE, `notes` is already an
      // opaque client-encrypted blob — store as-is, do NOT call encrypt().
      is_e2ee_encrypted: isE2EE = false
    } = entryData;

    // Branch on the E2EE flag:
    //   E2EE on  → notes is an opaque blob; store unchanged; is_encrypted=false; is_e2ee_encrypted=true
    //   E2EE off → notes (if any) is plaintext; encrypt with server key; is_encrypted=true; is_e2ee_encrypted=false
    //   no notes → both flags false
    let notesForDb = null;
    let isLegacyEncrypted = false;
    if (notes) {
      if (isE2EE) {
        notesForDb = notes;
        isLegacyEncrypted = false;
      } else {
        notesForDb = encrypt(notes);
        isLegacyEncrypted = true;
      }
    }
    const finalE2EEFlag = isE2EE && Boolean(notes);

    const query = `
      INSERT INTO mood_entries (
        entry_id, user_id, entry_date, entry_time,
        mood_score, energy_level, stress_level, sleep_quality, sleep_hours,
        anxiety_level, social_interaction_quality, notes, activities, triggers,
        is_encrypted, is_e2ee_encrypted
      )
      VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id, entry_date, entry_time)
      DO UPDATE SET
        mood_score = EXCLUDED.mood_score,
        energy_level = EXCLUDED.energy_level,
        stress_level = EXCLUDED.stress_level,
        sleep_quality = EXCLUDED.sleep_quality,
        sleep_hours = EXCLUDED.sleep_hours,
        anxiety_level = EXCLUDED.anxiety_level,
        social_interaction_quality = EXCLUDED.social_interaction_quality,
        notes = EXCLUDED.notes,
        activities = EXCLUDED.activities,
        triggers = EXCLUDED.triggers,
        is_encrypted = EXCLUDED.is_encrypted,
        is_e2ee_encrypted = EXCLUDED.is_e2ee_encrypted
      RETURNING *
    `;

    const values = [
      entryId,
      userId,
      moodScore,
      energyLevel,
      stressLevel,
      sleepQuality,
      sleepHours,
      anxietyLevel,
      socialInteractionQuality,
      notesForDb,
      JSON.stringify(activities || []),
      JSON.stringify(triggers || []),
      isLegacyEncrypted,
      finalE2EEFlag
    ];

    const result = await db.query(query, values);
    const entry = result.rows[0];

    // Server-side decrypt ONLY for the legacy path. E2EE entries pass the
    // opaque ciphertext back to the client for client-side decryption.
    if (entry.is_encrypted && entry.notes && !entry.is_e2ee_encrypted) {
      entry.notes = decrypt(entry.notes);
    }

    return entry;
  }

  /**
   * Get mood entries for a user with date range
   */
  static async getUserEntries(userId, { startDate, endDate, limit = 30, offset = 0 }) {
    let query = `
      SELECT * FROM mood_entries
      WHERE user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND entry_date >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND entry_date <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY entry_date DESC, entry_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    // Decrypt notes in entries
    return result.rows.map(entry => {
      if (entry.is_encrypted && entry.notes && !entry.is_e2ee_encrypted) {
        entry.notes = decrypt(entry.notes);
      }
      return entry;
    });
  }

  /**
   * Get a single mood entry
   */
  static async getById(entryId, userId) {
    const query = `
      SELECT * FROM mood_entries
      WHERE entry_id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [entryId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const entry = result.rows[0];
    if (entry.is_encrypted && entry.notes && !entry.is_e2ee_encrypted) {
      entry.notes = decrypt(entry.notes);
    }

    return entry;
  }

  /**
   * Update mood entry
   */
  static async update(entryId, userId, updates) {
    const allowedFields = [
      'mood_score', 'energy_level', 'stress_level', 'sleep_quality',
      'sleep_hours', 'anxiety_level', 'social_interaction_quality',
      'notes', 'activities', 'triggers'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    // Phase 1.3 step 5+7 (ADR-0009): the same E2EE branching as create().
    // If `is_e2ee_encrypted` is set in the update payload, the `notes` value
    // is treated as opaque ciphertext and stored unchanged.
    const updateIsE2EE = updates.is_e2ee_encrypted === true;
    Object.keys(updates).forEach(key => {
      if (key === 'is_e2ee_encrypted') return; // consumed above
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'notes') {
          fields.push(`${key} = $${paramCount}`);
          fields.push(`is_encrypted = $${paramCount + 1}`);
          fields.push(`is_e2ee_encrypted = $${paramCount + 2}`);
          if (updateIsE2EE) {
            values.push(updates[key]);          // opaque blob, store as-is
            values.push(false);                 // not legacy-server-encrypted
            values.push(true);                  // flag the row as E2EE
          } else {
            values.push(encrypt(updates[key])); // legacy server encrypt
            values.push(true);
            values.push(false);
          }
          paramCount += 3;
        } else if (key === 'activities' || key === 'triggers') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
          paramCount++;
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(entryId, userId);
    const query = `
      UPDATE mood_entries
      SET ${fields.join(', ')}
      WHERE entry_id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const entry = result.rows[0];
    if (entry.is_encrypted && entry.notes && !entry.is_e2ee_encrypted) {
      entry.notes = decrypt(entry.notes);
    }

    return entry;
  }

  /**
   * Delete mood entry
   */
  static async delete(entryId, userId) {
    const query = `
      DELETE FROM mood_entries
      WHERE entry_id = $1 AND user_id = $2
      RETURNING entry_id
    `;

    const result = await db.query(query, [entryId, userId]);
    return result.rows[0];
  }

  /**
   * Get mood statistics for time period
   */
  static async getStatistics(userId, { startDate, endDate }) {
    return cache.wrap(cache.short, cache.key('stats', userId, startDate, endDate), () =>
      this._getStatisticsUncached(userId, { startDate, endDate })
    );
  }

  static async _getStatisticsUncached(userId, { startDate, endDate }) {
    const query = `
      SELECT
        COUNT(*) as total_entries,
        AVG(mood_score) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(stress_level) as avg_stress,
        AVG(sleep_quality) as avg_sleep_quality,
        AVG(sleep_hours) as avg_sleep_hours,
        AVG(anxiety_level) as avg_anxiety,
        AVG(social_interaction_quality) as avg_social,
        MIN(mood_score) as min_mood,
        MAX(mood_score) as max_mood,
        MIN(entry_date) as first_entry_date,
        MAX(entry_date) as last_entry_date
      FROM mood_entries
      WHERE user_id = $1
        AND entry_date >= $2
        AND entry_date <= $3
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows[0];
  }

  /**
   * Get mood trends over time
   */
  static async getTrends(userId, { startDate, endDate, groupBy = 'week' }) {
    return cache.wrap(cache.short, cache.key('trends', userId, startDate, endDate, groupBy), () =>
      this._getTrendsUncached(userId, { startDate, endDate, groupBy })
    );
  }

  static async _getTrendsUncached(userId, { startDate, endDate, groupBy = 'week' }) {
    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' :
                       groupBy === 'week' ? 'IYYY-IW' :
                       'YYYY-MM';

    const query = `
      SELECT
        TO_CHAR(entry_date, '${dateFormat}') as period,
        COUNT(*) as entry_count,
        AVG(mood_score) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(stress_level) as avg_stress,
        AVG(anxiety_level) as avg_anxiety,
        AVG(sleep_quality) as avg_sleep_quality
      FROM mood_entries
      WHERE user_id = $1
        AND entry_date >= $2
        AND entry_date <= $3
      GROUP BY period
      ORDER BY period DESC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = MoodEntry;
