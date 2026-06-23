/**
 * auditAnchorSink — publishes an audit anchor's commitment to an append-only
 * store OUTSIDE the database (ADR-0015, F.8).
 *
 * This is the part that gives the anchor its teeth: the anchor_hash is emitted
 * somewhere a database attacker does not control, so a later full-chain rewrite
 * cannot also rewrite the published commitment to match.
 *
 * Pluggable + dependency-free. Configured via env:
 *   AUDIT_ANCHOR_SINK = 'file' (default) | 'stdout' | 'none'
 *   AUDIT_ANCHOR_FILE = path (default backend/data/audit_anchors.log)
 *
 * The default 'file' sink writes one JSON line per anchor to a local append-only
 * log. That is already off the DB; for a stronger trust boundary an operator
 * points the file at a directory that is itself committed to an external
 * append-only target (a git remote, an RFC-3161 TSA, or OpenTimestamps) — see
 * ADR-0015. Wiring such a target is a deployment concern, not a code dependency.
 *
 * Best-effort: never throws. Returns a receipt object (stored on the anchor) or
 * null if publication was disabled or failed.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const DEFAULT_FILE = path.resolve(__dirname, '..', '..', 'data', 'audit_anchors.log');

function publishAnchor(commitment) {
  const sink = process.env.AUDIT_ANCHOR_SINK || 'file';
  const publishedAt = new Date().toISOString();
  const line = JSON.stringify({ ...commitment, published_at: publishedAt });

  try {
    if (sink === 'none') {
      return null;
    }

    if (sink === 'stdout') {
      process.stdout.write(`[audit-anchor] ${line}\n`);
      return { sink: 'stdout', published_at: publishedAt };
    }

    // Default: append-only file outside the DB.
    const file = process.env.AUDIT_ANCHOR_FILE || DEFAULT_FILE;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${line}\n`, { encoding: 'utf8' });
    return { sink: 'file', path: file, published_at: publishedAt };
  } catch (err) {
    logger.warn('auditAnchorSink.publishAnchor failed (non-blocking)', { error: err.message });
    return null;
  }
}

module.exports = { publishAnchor };
