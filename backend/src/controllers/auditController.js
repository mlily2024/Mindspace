const aiAuditService = require('../services/aiAuditService');
const logger = require('../config/logger');

/**
 * Audit log controller — user-facing endpoints for the AI audit log chain.
 *
 * Phase 1.2 of the privacy-enhancements handover (2026-06-15). The underlying
 * mechanism (per-user hash-chained log of every Luna interaction) shipped in
 * commit `0390d48` as ADR-0004; these two endpoints surface it to the user so
 * the integrity guarantee is verifiable end-to-end, not just claimed.
 *
 * Both endpoints are bearer-auth-protected and scope to `req.user.userId`. A
 * user can NEVER verify or download anyone else's chain.
 */

/**
 * GET /api/audit/verify-mine
 * Walks the requesting user's chain and reports `ok` + `count`, or `ok: false`
 * with `brokenAt` (sequence number of the offending row) on tamper.
 */
const verifyMyChain = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const result = await aiAuditService.verifyChain(userId);
    return res.json({
      success: true,
      data: {
        ...result,
        verified_at: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('auditController.verifyMyChain failed', { error: err.message });
    return next(err);
  }
};

/**
 * GET /api/audit/download-mine
 * Returns the full chain (canonical payload fields + hashes) so the user (or
 * a third-party verifier) can rebuild and compare each row's hash independently
 * of the server's `verifyChain` implementation.
 */
const downloadMyChain = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const chain = await aiAuditService.exportChain(userId);
    // Suggest a download filename when the client requests via a browser
    res.setHeader('Content-Disposition',
      `attachment; filename="mindspace_audit_chain_${userId}_${new Date().toISOString().slice(0, 10)}.json"`);
    return res.json({ success: true, data: chain });
  } catch (err) {
    logger.error('auditController.downloadMyChain failed', { error: err.message });
    return next(err);
  }
};

module.exports = {
  verifyMyChain,
  downloadMyChain
};
