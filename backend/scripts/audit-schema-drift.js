#!/usr/bin/env node
/**
 * audit-schema-drift.js — Mindspace polish plan, Weakness 1 (2026-06-17).
 *
 * Three bugs in two days (peer-support member_id, Luna 3 missing tables,
 * Luna sessionId null) all shared the same shape: code in src/ references
 * a table or column that no migration creates. This script catches that
 * bug class permanently.
 *
 * What it does
 *   1. Parse every CREATE TABLE block from schema.sql + every migration.
 *      Build a set of table names known to exist after all migrations apply.
 *   2. Scan every .js file under src/ (models + controllers + services).
 *      Strip comments. Find every table reference via FROM / INSERT INTO /
 *      UPDATE / DELETE FROM / JOIN <name>.
 *   3. Subtract the allowlist:
 *        - pg_catalog.* and information_schema.* (postgres meta tables)
 *        - CTEs detected via WITH <name> AS (...) earlier in the same file
 *   4. Report every reference to a name not in the schema set.
 *      Exit non-zero if any findings — safe to add to CI as a guard.
 *
 * What it does NOT do (yet)
 *   - Column-level checks. The bug class we hit was at the TABLE name
 *     layer; column drift is a follow-up. The script's regex is already
 *     set up to extract columns from CREATE TABLE bodies for when we add
 *     this in W1's next pass.
 *   - Resolve template-literal interpolation in JS SQL strings (rare in
 *     this codebase — only adminController has one or two cases).
 *
 * Usage
 *   node backend/scripts/audit-schema-drift.js
 *   exit 0 → clean
 *   exit 1 → at least one mismatch; report on stderr
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_FILE = path.join(ROOT, 'database', 'schema.sql');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');
const SRC_DIR = path.join(ROOT, 'src');

// ─── 1. Build the set of tables/columns that exist after all migrations ─────

const stripSqlComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ');

const extractCreateTables = (sqlText, sourceLabel) => {
  const tables = new Map(); // name -> { columns: Set, source: string }
  const stripped = stripSqlComments(sqlText);
  // Match CREATE TABLE [IF NOT EXISTS] [schema.]name (...)
  // We allow a balance counter rather than a non-greedy match because column
  // definitions can themselves contain () e.g. VARCHAR(50), NUMERIC(4,2).
  const headerRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(/gi;
  let m;
  while ((m = headerRe.exec(stripped))) {
    const tableName = m[1].toLowerCase();
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < stripped.length && depth > 0) {
      const ch = stripped[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    const body = stripped.slice(startIdx, i - 1);
    const columns = new Set();
    // Each column def starts at a token boundary as `<name> <type>...`
    // Constraints start with PRIMARY/FOREIGN/UNIQUE/CHECK/CONSTRAINT.
    for (const line of body.split(',')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const firstToken = trimmed.split(/\s+/)[0].toLowerCase();
      if (/^(primary|foreign|unique|check|constraint|exclude)$/.test(firstToken)) continue;
      if (/^[a-z_][a-z0-9_]*$/.test(firstToken)) columns.add(firstToken);
    }
    tables.set(tableName, { columns, source: sourceLabel });
  }
  return tables;
};

const buildSchemaUniverse = () => {
  const universe = new Map();
  const inputs = [];
  if (fs.existsSync(SCHEMA_FILE)) {
    inputs.push({ file: SCHEMA_FILE, label: 'database/schema.sql' });
  }
  for (const f of fs.readdirSync(MIGRATIONS_DIR).filter(x => x.endsWith('.sql')).sort()) {
    inputs.push({
      file: path.join(MIGRATIONS_DIR, f),
      label: `database/migrations/${f}`,
    });
  }
  for (const { file, label } of inputs) {
    const txt = fs.readFileSync(file, 'utf8');
    for (const [name, info] of extractCreateTables(txt, label)) {
      // Last-wins: if a later migration redefines a table, that's authoritative
      // for the purposes of "does this exist when the code runs."
      universe.set(name, info);
    }
  }
  return universe;
};

// ─── 2. Scan source for table references ────────────────────────────────────

const stripJsComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, ' ');

const PG_META_PREFIXES = ['pg_catalog.', 'information_schema.'];
const PG_META_ALLOWLIST = new Set([
  'pg_indexes', 'pg_tables', 'pg_class', 'pg_attribute', 'pg_constraint',
  'pg_namespace', 'pg_stat_activity', 'pg_locks',
]);

// Known-experimental tables — services for features categorised as
// Experimental (hidden from nav per the maturity-tier work in a4f5515).
// References to these are "drift in a feature we already labelled WIP"
// rather than "regression in the Core/Beta surface." The script reports
// them as INFO but does not fail the build on them.
//
// Adding a table here is a deliberate choice: it acknowledges that this
// feature's schema/code never aligned and we are deferring the fix. To
// promote a feature OUT of experimental status, remove its tables from
// this set; the script will then guard against further drift.
const EXPERIMENTAL_TABLES = new Set([
  // Clinical assessments + clinician reports (hidden in nav)
  'clinical_assessment_items', 'clinical_assessment_responses',
  'clinical_safety_flags',
  // Enhanced peer support (hidden — base PeerSupport is the user-facing one)
  'peer_groups', 'peer_group_members', 'peer_group_exercises',
  // Predictive engine (hidden)
  'predictive_engine_models', 'predictive_engine_predictions',
  'sleep_records', 'weather_records', 'activities',
  // Protocols (hidden)
  'protocol_enrollments',
  // Voice signature (not in nav at all; used only by clinical surface)
  'voice_signature_baselines', 'voice_signature_samples',
]);

const TABLE_REF_PATTERNS = [
  // Capture the table name; ignore optional alias and qualifiers.
  /\bFROM\s+([a-z_][a-z0-9_]*)\b/gi,
  /\bJOIN\s+([a-z_][a-z0-9_]*)\b/gi,
  /\bINTO\s+([a-z_][a-z0-9_]*)\b/gi,        // INSERT INTO x
  /\bUPDATE\s+([a-z_][a-z0-9_]*)\b/gi,
  /\bDELETE\s+FROM\s+([a-z_][a-z0-9_]*)\b/gi,
  /\bTRUNCATE(?:\s+TABLE)?\s+([a-z_][a-z0-9_]*)\b/gi,
];

// SQL reserved that occasionally follow FROM/JOIN/etc and are not tables.
const SQL_RESERVED = new Set([
  'select', 'where', 'and', 'or', 'on', 'set', 'values', 'returning', 'as',
  'lateral', 'cross', 'natural', 'outer', 'inner', 'left', 'right', 'full',
  'using', 'limit', 'offset', 'order', 'group', 'having', 'with', 'union',
  'intersect', 'except', 'window', 'partition', 'rows', 'range',
  'now', 'current_timestamp', 'current_date', 'current_time', 'current_user',
  // Words that can appear after "FROM" in PG-ism JSON / text functions
  'unnest', 'generate_series', 'jsonb_each', 'json_each', 'jsonb_array_elements',
  'json_array_elements', 'string_to_array', 'array',
  // Things that can sit between FROM and the real table
  'only', 'recursive',
]);

const extractCteNames = (text) => {
  const ctes = new Set();
  // WITH name AS (
  // WITH RECURSIVE name AS (
  const re = /\bWITH\s+(?:RECURSIVE\s+)?([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
  let m;
  while ((m = re.exec(text))) ctes.add(m[1].toLowerCase());
  // Chained CTEs: , next AS (
  const chainRe = /,\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
  while ((m = chainRe.exec(text))) ctes.add(m[1].toLowerCase());
  return ctes;
};

const walkJsFiles = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
};

// Extract every backtick template literal in a file along with its absolute
// start offset (so we can map matches back to line numbers in the original).
// Naive but correct enough for our codebase — there are no `${\`}` nested
// backticks in our SQL. We also strip out ${...} interpolations so the
// embedded JS doesn't trip the TABLE_REF_PATTERNS.
const extractBacktickStrings = (text) => {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '`') { i += 1; continue; }
    const start = i + 1;
    let j = start;
    while (j < text.length && text[j] !== '`') {
      if (text[j] === '\\') j += 2;
      else j += 1;
    }
    let body = text.slice(start, j);
    // Blank out ${...} interpolations
    body = body.replace(/\$\{[^}]*\}/g, ' ');
    out.push({ start, body });
    i = j + 1;
  }
  return out;
};

const looksLikeSql = (body) =>
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|TRUNCATE|WITH\s+[a-z_])/i.test(body);

// EXTRACT(DOW FROM <column>) and similar PG functions use the FROM keyword
// to separate an interval-unit from a date expression — it is NOT a table
// reference. Skip any FROM that sits inside an EXTRACT(...).
const isInsideExtract = (body, idx) => {
  // Walk backwards to the nearest unmatched `(`. If the token immediately
  // before it (skipping whitespace) is EXTRACT, this FROM is the keyword
  // form, not a table reference.
  let depth = 0;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const ch = body[i];
    if (ch === ')') depth += 1;
    else if (ch === '(') {
      if (depth === 0) {
        // Found the opening paren; check what precedes it
        const before = body.slice(0, i).replace(/\s+$/, '');
        if (/EXTRACT$/i.test(before)) return true;
        return false;
      }
      depth -= 1;
    }
  }
  return false;
};

const scanFile = (file, schemaTables) => {
  const raw = fs.readFileSync(file, 'utf8');
  const text = stripJsComments(raw);

  // Only scan SQL-shaped backtick literals. This eliminates the entire
  // class of "FROM bed" / "from this" false positives from English text
  // inside regular string literals.
  const sqlBlocks = extractBacktickStrings(text).filter(b => looksLikeSql(b.body));

  const findings = [];
  for (const block of sqlBlocks) {
    const ctes = extractCteNames(block.body);
    for (const re of TABLE_REF_PATTERNS) {
      const local = new RegExp(re.source, re.flags);
      let m;
      while ((m = local.exec(block.body))) {
        const name = m[1].toLowerCase();
        if (SQL_RESERVED.has(name)) continue;
        if (schemaTables.has(name)) continue;
        if (ctes.has(name)) continue;
        if (PG_META_ALLOWLIST.has(name)) continue;
        if (PG_META_PREFIXES.some(p => name.startsWith(p))) continue;
        if (isInsideExtract(block.body, m.index)) continue;
        // Map back to a line number in the original raw text.
        const absIdx = block.start + m.index;
        const lineNo = (text.slice(0, absIdx).match(/\n/g) || []).length + 1;
        findings.push({
          file: path.relative(ROOT, file),
          line: lineNo,
          ref: name,
          context: block.body.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim(),
          experimental: EXPERIMENTAL_TABLES.has(name),
        });
      }
    }
  }
  return findings;
};

// ─── 3. Run ─────────────────────────────────────────────────────────────────

const main = () => {
  const schemaTables = buildSchemaUniverse();
  console.log(`[audit] ${schemaTables.size} tables discovered across schema + migrations.`);

  const jsFiles = walkJsFiles(SRC_DIR);
  console.log(`[audit] scanning ${jsFiles.length} backend .js files for table refs…\n`);

  const allFindings = [];
  for (const f of jsFiles) allFindings.push(...scanFile(f, schemaTables));

  // Split findings: Core/Beta drift (would fail CI) vs Experimental drift
  // (acknowledged via allowlist; reported but does not fail).
  const failFindings = allFindings.filter(f => !f.experimental);
  const infoFindings = allFindings.filter(f =>  f.experimental);

  const group = (list) => {
    const map = new Map();
    for (const f of list) {
      if (!map.has(f.ref)) map.set(f.ref, []);
      map.get(f.ref).push(f);
    }
    return map;
  };
  const printGroup = (label, prefix, map, stream) => {
    if (!map.size) return;
    stream(`\n[audit] ${label} — ${map.size} table${map.size === 1 ? '' : 's'}:\n`);
    for (const [ref, list] of Array.from(map.entries()).sort()) {
      stream(`  ${prefix} ${ref}  (${list.length} ref${list.length === 1 ? '' : 's'})`);
      for (const f of list.slice(0, 3)) stream(`      ${f.file}:${f.line}    ${f.context}`);
      if (list.length > 3) stream(`      … and ${list.length - 3} more.`);
    }
  };

  const log = (s) => console.log(s);
  const err = (s) => console.error(s);

  if (failFindings.length) {
    err(`[audit] FAIL — ${failFindings.length} reference(s) to a table no migration creates and which is NOT on the Experimental allowlist.`);
    printGroup('Core/Beta drift (fails build)', '✗', group(failFindings), err);
    if (infoFindings.length) printGroup('Experimental drift (allow-listed; ignored)', 'ℹ', group(infoFindings), err);
    err(`\n[audit] Each FAIL finding is either:`);
    err(`  (a) a real bug — fix the code or add a migration that creates the table`);
    err(`  (b) a false positive — tighten the regex or extend the allowlist`);
    err(`  (c) a CTE the script missed — extend extractCteNames`);
    err(`  (d) a newly-experimental table — add it to EXPERIMENTAL_TABLES with a justification\n`);
    process.exit(1);
  }

  log('[audit] PASS — Core/Beta surface has no schema drift.');
  if (infoFindings.length) {
    printGroup(`Experimental drift (${infoFindings.length} ref(s), allow-listed)`, 'ℹ', group(infoFindings), log);
    log(`\n[audit] These belong to features hidden from the nav. To promote one out of Experimental,`);
    log(`        remove its tables from EXPERIMENTAL_TABLES in this script and the schema must match.`);
  }
  process.exit(0);
};

main();
