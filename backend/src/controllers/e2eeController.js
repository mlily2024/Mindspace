const db = require('../config/database');
const logger = require('../config/logger');

/**
 * E2EE controller — stores and retrieves opaque key-wrapping material
 * for the client-side E2EE design (ADR-0009 phase 1.3 v1).
 *
 * The server NEVER sees:
 *   - the user's passphrase
 *   - the user's 12-word recovery phrase
 *   - the unwrapped master key
 *
 * The server stores ONLY:
 *   - the per-user KDF salt + params (public)
 *   - two wrapped copies of the master key (one under passphrase-key,
 *     one under recovery-key) (opaque to server)
 *
 * Every endpoint is scoped to req.user.userId via bearer JWT.
 * There is no admin / cross-user variant by design.
 */

const KNOWN_KDF_ALGOS = new Set(['argon2id', 'pbkdf2-sha256']);

const isNonEmptyBase64Like = (s, maxLen = 8192) =>
  typeof s === 'string' && s.length > 0 && s.length <= maxLen && /^[A-Za-z0-9+/=_-]+$/.test(s);

const isValidKdfParams = (algo, params) => {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) return false;
  if (algo === 'argon2id') {
    return Number.isInteger(params.memory)      && params.memory      >= 8192  && params.memory      <= 1048576 // 8 MiB..1 GiB
        && Number.isInteger(params.time)        && params.time        >= 1     && params.time        <= 20
        && Number.isInteger(params.parallelism) && params.parallelism >= 1     && params.parallelism <= 8;
  }
  if (algo === 'pbkdf2-sha256') {
    return Number.isInteger(params.iterations) && params.iterations >= 100000 && params.iterations <= 10000000;
  }
  return false;
};

/**
 * POST /api/e2ee/setup
 * First-time enrolment of a user in E2EE. Body: the full key-wrap bundle.
 * Returns 201 on insert, 409 if the user already has metadata (use PUT
 * /api/e2ee/rewrap to change the passphrase wrap; the recovery wrap can
 * only be reset via a "regenerate recovery phrase" flow which v1 doesn't
 * yet expose — preserving the original recovery phrase is the safer default).
 */
const setupE2EE = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const {
      kdf_algo = 'argon2id',
      kdf_salt,
      kdf_params,
      wrapped_master_key,
      wrapped_master_iv,
      wrapped_master_recovery,
      wrapped_master_recovery_iv
    } = req.body || {};

    if (!KNOWN_KDF_ALGOS.has(kdf_algo)) {
      return res.status(400).json({ success: false, message: 'kdf_algo must be one of: argon2id, pbkdf2-sha256' });
    }
    if (!isNonEmptyBase64Like(kdf_salt, 256)) {
      return res.status(400).json({ success: false, message: 'kdf_salt must be a non-empty base64 string up to 256 chars' });
    }
    if (!isValidKdfParams(kdf_algo, kdf_params)) {
      return res.status(400).json({ success: false, message: `kdf_params is invalid for algo=${kdf_algo}` });
    }
    for (const [field, val] of Object.entries({
      wrapped_master_key, wrapped_master_iv,
      wrapped_master_recovery, wrapped_master_recovery_iv
    })) {
      if (!isNonEmptyBase64Like(val, 4096)) {
        return res.status(400).json({ success: false, message: `${field} must be a non-empty base64 string up to 4096 chars` });
      }
    }

    // Atomic insert; 409 if user already has metadata (existing row
    // means the user already set up E2EE — re-setup would silently
    // orphan whatever notes they had encrypted under the old master key).
    let result;
    try {
      result = await db.query(
        `INSERT INTO user_e2ee_metadata (
           user_id, kdf_algo, kdf_salt, kdf_params,
           wrapped_master_key, wrapped_master_iv,
           wrapped_master_recovery, wrapped_master_recovery_iv
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
         RETURNING user_id, created_at`,
        [
          userId, kdf_algo, kdf_salt, JSON.stringify(kdf_params),
          wrapped_master_key, wrapped_master_iv,
          wrapped_master_recovery, wrapped_master_recovery_iv
        ]
      );
    } catch (err) {
      // 23505 = unique_violation (the primary-key conflict on user_id)
      if (err && err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'E2EE already set up for this user. To change the passphrase use PUT /api/e2ee/rewrap.'
        });
      }
      throw err;
    }

    return res.status(201).json({
      success: true,
      data: {
        user_id:    result.rows[0].user_id,
        created_at: result.rows[0].created_at
      }
    });
  } catch (err) {
    logger.error('e2eeController.setupE2EE failed', { error: err.message });
    return next(err);
  }
};

/**
 * GET /api/e2ee/metadata
 * Returns the full bundle so the client can derive the passphrase key
 * (or recovery key) and unwrap the master key locally.
 * 404 when the user has not enrolled in E2EE.
 */
const getMetadata = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const r = await db.query(
      `SELECT kdf_algo, kdf_salt, kdf_params,
              wrapped_master_key, wrapped_master_iv,
              wrapped_master_recovery, wrapped_master_recovery_iv,
              created_at, updated_at
         FROM user_e2ee_metadata
        WHERE user_id = $1`,
      [userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ success: false, message: 'E2EE not set up for this user' });
    }
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    logger.error('e2eeController.getMetadata failed', { error: err.message });
    return next(err);
  }
};

/**
 * PUT /api/e2ee/rewrap
 * Update the passphrase-wrapped master key only. Used on password change:
 * client derives a new passphrase_key from the new passphrase + EXISTING
 * salt, re-wraps the master key, sends the new wrap here. The salt and
 * recovery wrap are unchanged.
 *
 * Does NOT change the master key itself — the underlying record ciphertext
 * stays decryptable with the same master key after rewrap.
 */
const rewrapMasterKey = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { wrapped_master_key, wrapped_master_iv } = req.body || {};
    if (!isNonEmptyBase64Like(wrapped_master_key, 4096)) {
      return res.status(400).json({ success: false, message: 'wrapped_master_key must be a non-empty base64 string up to 4096 chars' });
    }
    if (!isNonEmptyBase64Like(wrapped_master_iv, 4096)) {
      return res.status(400).json({ success: false, message: 'wrapped_master_iv must be a non-empty base64 string up to 4096 chars' });
    }
    const r = await db.query(
      `UPDATE user_e2ee_metadata
          SET wrapped_master_key = $2,
              wrapped_master_iv  = $3
        WHERE user_id = $1
        RETURNING user_id, updated_at`,
      [userId, wrapped_master_key, wrapped_master_iv]
    );
    if (!r.rows.length) {
      return res.status(404).json({ success: false, message: 'E2EE not set up; nothing to rewrap' });
    }
    return res.json({
      success: true,
      data: {
        user_id:    r.rows[0].user_id,
        updated_at: r.rows[0].updated_at
      }
    });
  } catch (err) {
    logger.error('e2eeController.rewrapMasterKey failed', { error: err.message });
    return next(err);
  }
};

module.exports = {
  setupE2EE,
  getMetadata,
  rewrapMasterKey,
  // Exported for testing
  _internal: { isNonEmptyBase64Like, isValidKdfParams, KNOWN_KDF_ALGOS }
};
