/**
 * anchorService — external anchoring of the AI audit log (ADR-0015, F.8).
 *
 * Threat model: aiAuditService.verifyChain proves a user's chain is internally
 * consistent, but NOT that it matches what existed earlier — a full DB rewrite
 * from a forged genesis still verifies. This service periodically commits the
 * whole audit state to a Merkle root over every user's current chain head and
 * publishes the commitment to an append-only store outside the DB (see
 * auditAnchorSink). The anchors are themselves hash-chained.
 *
 * Detection property: a chain head record_hash commits (transitively, via the
 * hash chain) to that user's entire history up to that point. So if any past
 * record is later altered, the head record_hash changes, the stored leaf no
 * longer matches, the recomputed Merkle root diverges from the externally
 * published one, and verifyAnchor flags it.
 *
 * All SQL goes through the shared db; no production audit path is touched.
 */

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');
const { publishAnchor } = require('./auditAnchorSink');

const GENESIS_ANCHOR = 'GENESIS_ANCHOR';
const ALGORITHM = 'sha256-merkle-v1';

const sha256Hex = (input) =>
  crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');

/**
 * Merkle root over an ordered array of hex leaf hashes.
 *  - empty  -> SHA-256('') sentinel (a well-defined "no audit data" root)
 *  - single -> that leaf
 *  - odd    -> the last node is duplicated (paired with itself)
 * @param {string[]} leafHashes
 * @returns {string} hex root
 */
function merkleRoot(leafHashes) {
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    return sha256Hex('');
  }
  let level = leafHashes.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}

/** Leaf commitment for one user's chain head. Binds identity + position + hash. */
const leafHash = (leaf) => sha256Hex(`${leaf.user_id}:${leaf.head_seq}:${leaf.head_hash}`);

/** Deterministic anchor hash. created_at is metadata (the external receipt time-binds). */
const computeAnchorHash = ({ sequence_number, user_count, record_count, merkle_root, prev_anchor_hash }) =>
  sha256Hex([sequence_number, user_count, record_count, merkle_root, prev_anchor_hash].join('|'));

/** Current head (max sequence_number) of every user's chain. */
async function getChainHeads() {
  const r = await db.query(
    `SELECT DISTINCT ON (user_id) user_id, sequence_number AS head_seq, record_hash AS head_hash
       FROM ai_audit_log
      ORDER BY user_id, sequence_number DESC`
  );
  return r.rows.map((row) => ({
    user_id: row.user_id,
    head_seq: Number(row.head_seq),
    head_hash: row.head_hash,
  }));
}

/**
 * Create a new anchor: commit to all chain heads, chain it onto the previous
 * anchor, persist, and publish the commitment externally (best-effort).
 * @returns {Promise<object>} the stored anchor row (+ external_receipt)
 */
async function createAnchor() {
  const heads = await getChainHeads();
  // Deterministic leaf order so the same state always yields the same root.
  heads.sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
  const merkle_root = merkleRoot(heads.map(leafHash));

  const recCountQ = await db.query(`SELECT COUNT(*)::bigint AS c FROM ai_audit_log`);
  const record_count = Number(recCountQ.rows[0].c);

  const prevQ = await db.query(
    `SELECT sequence_number, anchor_hash FROM audit_anchors ORDER BY sequence_number DESC LIMIT 1`
  );
  const sequence_number = prevQ.rows.length ? Number(prevQ.rows[0].sequence_number) + 1 : 1;
  const prev_anchor_hash = prevQ.rows.length ? prevQ.rows[0].anchor_hash : GENESIS_ANCHOR;
  const user_count = heads.length;

  const anchor_hash = computeAnchorHash({
    sequence_number, user_count, record_count, merkle_root, prev_anchor_hash,
  });

  const ins = await db.query(
    `INSERT INTO audit_anchors
       (sequence_number, user_count, record_count, merkle_root, algorithm, leaves, prev_anchor_hash, anchor_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [sequence_number, user_count, record_count, merkle_root, ALGORITHM, JSON.stringify(heads), prev_anchor_hash, anchor_hash]
  );
  const anchor = ins.rows[0];

  const receipt = publishAnchor({
    sequence_number, user_count, record_count, merkle_root, prev_anchor_hash, anchor_hash, algorithm: ALGORITHM,
  });
  if (receipt) {
    await db
      .query(`UPDATE audit_anchors SET external_receipt = $1 WHERE anchor_id = $2`, [
        JSON.stringify(receipt), anchor.anchor_id,
      ])
      .catch((err) => logger.warn('anchorService: receipt persist failed', { error: err.message }));
    anchor.external_receipt = receipt;
  }

  logger.info('audit anchor created', {
    sequence_number, anchor_hash, user_count, record_count, published: !!receipt,
  });
  return anchor;
}

/**
 * Verify a stored anchor against the live audit log.
 * Checks: (1) leaves -> merkle_root reproduces; (2) anchor_hash reproduces;
 * (3) anchor-of-anchors linkage; (4) every committed chain head is still present
 * and unchanged in ai_audit_log (the tamper check).
 * @param {string} anchorId
 * @returns {Promise<{ok:boolean, anchorId:string, sequence_number:number, checks:object}>}
 */
async function verifyAnchor(anchorId) {
  const a = await db.query(`SELECT * FROM audit_anchors WHERE anchor_id = $1`, [anchorId]);
  if (a.rows.length === 0) {
    return { ok: false, anchorId, sequence_number: null, checks: { exists: false } };
  }
  const anchor = a.rows[0];
  const leaves = typeof anchor.leaves === 'string' ? JSON.parse(anchor.leaves) : anchor.leaves;

  const merkleRootOk = merkleRoot(leaves.map(leafHash)) === anchor.merkle_root;
  const anchorHashOk =
    computeAnchorHash({
      sequence_number: Number(anchor.sequence_number),
      user_count: Number(anchor.user_count),
      record_count: Number(anchor.record_count),
      merkle_root: anchor.merkle_root,
      prev_anchor_hash: anchor.prev_anchor_hash,
    }) === anchor.anchor_hash;

  // Anchor-of-anchors linkage.
  let anchorChainOk;
  if (Number(anchor.sequence_number) === 1) {
    anchorChainOk = anchor.prev_anchor_hash === GENESIS_ANCHOR;
  } else {
    const prev = await db.query(
      `SELECT anchor_hash FROM audit_anchors WHERE sequence_number = $1`,
      [Number(anchor.sequence_number) - 1]
    );
    anchorChainOk = prev.rows.length > 0 && prev.rows[0].anchor_hash === anchor.prev_anchor_hash;
  }

  // Tamper check: each committed head must still exist unchanged.
  const leafMismatches = [];
  for (const leaf of leaves) {
    const rec = await db.query(
      `SELECT record_hash FROM ai_audit_log WHERE user_id = $1 AND sequence_number = $2`,
      [leaf.user_id, leaf.head_seq]
    );
    const current = rec.rows.length ? rec.rows[0].record_hash : null;
    if (current !== leaf.head_hash) {
      leafMismatches.push({ user_id: leaf.user_id, head_seq: leaf.head_seq, expected: leaf.head_hash, found: current });
    }
  }

  const ok = merkleRootOk && anchorHashOk && anchorChainOk && leafMismatches.length === 0;
  return {
    ok,
    anchorId,
    sequence_number: Number(anchor.sequence_number),
    checks: { exists: true, merkleRootOk, anchorHashOk, anchorChainOk, leafMismatches },
  };
}

module.exports = {
  createAnchor,
  verifyAnchor,
  merkleRoot,
  leafHash,
  computeAnchorHash,
  getChainHeads,
  GENESIS_ANCHOR,
  ALGORITHM,
};
