#!/usr/bin/env node
/**
 * Mindspace demo-data seeder for screenshot capture.
 *
 * Registers (or logs into) a demo user, seeds 7 days of varied mood
 * entries directly via the DB (so dates are realistically backdated —
 * the API uses CURRENT_DATE, which would give a single-day chart), runs
 * a short Luna conversation, and generates insights — so the dashboard,
 * insights and chat screens render populated, not empty.
 *
 * Idempotent: re-running just refreshes the existing demo user's data.
 *
 * Requirements:
 *   - The backend must be running (npm run dev) — script hits the API
 *     for auth, Luna and insights.
 *   - backend/.env must be configured (DB, JWT_SECRET, ENCRYPTION_KEY).
 *
 * Usage:
 *   node backend/scripts/seed-demo-data.js
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const { encrypt } = require('../src/utils/encryption');

const BASE = process.env.SEED_API_BASE || 'http://localhost:5000/api';

const DEMO = {
  email:     'demo@mindspace.local',
  password:  'DemoMindspace!2026',
  username:  'Demo User',
  userGroup: 'professional'
};

// ─── Seven days of realistic mood data ───────────────────────────────────────
// `day` is days-ago (6 = oldest, 0 = today). The progression deliberately
// shows a dip mid-week followed by recovery, so the dashboard trend line
// and the insights engine have something interesting to render.
const SEVEN_DAYS = [
  { day: 6, mood: 3, energy: 3, stress: 4, anxiety: 4, social: 3, sleep_q: 2, sleep_h: 5.0,
    notes: 'Long day at work, struggling to relax.',
    activities: ['work', 'commute'],   triggers: ['deadline'] },
  { day: 5, mood: 2, energy: 2, stress: 5, anxiety: 5, social: 2, sleep_q: 2, sleep_h: 4.5,
    notes: 'Tough morning, kept ruminating about yesterday.',
    activities: ['work'],               triggers: ['conflict at work'] },
  { day: 4, mood: 4, energy: 4, stress: 3, anxiety: 3, social: 4, sleep_q: 4, sleep_h: 7.0,
    notes: 'Took a walk in the park at lunch — helped.',
    activities: ['walk', 'work'],       triggers: [] },
  { day: 3, mood: 4, energy: 4, stress: 3, anxiety: 2, social: 4, sleep_q: 4, sleep_h: 7.5,
    notes: 'Slept properly last night. Steady day.',
    activities: ['work', 'cooking'],    triggers: [] },
  { day: 2, mood: 3, energy: 3, stress: 3, anxiety: 3, social: 3, sleep_q: 3, sleep_h: 6.0,
    notes: 'Neutral kind of day, nothing notable.',
    activities: ['work'],               triggers: [] },
  { day: 1, mood: 5, energy: 5, stress: 2, anxiety: 2, social: 5, sleep_q: 5, sleep_h: 8.0,
    notes: 'Caught up with an old friend — felt really energised after.',
    activities: ['social', 'walk'],     triggers: [] },
  { day: 0, mood: 4, energy: 4, stress: 2, anxiety: 2, social: 4, sleep_q: 4, sleep_h: 7.5,
    notes: 'Steady. Good week overall after a rough start.',
    activities: ['work', 'reading'],    triggers: [] }
];

// ─── Tiny fetch wrapper ──────────────────────────────────────────────────────
const postJson = async (urlPath, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* response had no JSON body */ }
  return { status: res.status, data };
};

// ─── Stage 1: register or log in the demo user ───────────────────────────────
const getOrCreateUser = async () => {
  const login = await postJson('/auth/login', { email: DEMO.email, password: DEMO.password });
  if (login.status === 200 && login.data && login.data.data && login.data.data.token) {
    return { userId: login.data.data.user.userId, token: login.data.data.token, isNew: false };
  }
  const reg = await postJson('/auth/register', DEMO);
  if (reg.status >= 200 && reg.status < 300 && reg.data && reg.data.data && reg.data.data.token) {
    return { userId: reg.data.data.user.userId, token: reg.data.data.token, isNew: true };
  }
  throw new Error(`Could not register or log in demo user: ${reg.status} ${JSON.stringify(reg.data)}`);
};

// ─── Stage 2: seed 7 backdated mood entries (direct DB so dates are real) ────
const seedMoodEntries = async (userId) => {
  console.log('Seeding 7 days of mood entries...');

  // Wipe any existing entries in the seed window so re-runs are clean.
  await pool.query(
    `DELETE FROM mood_entries
       WHERE user_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '7 days'`,
    [userId]
  );

  for (const d of SEVEN_DAYS) {
    const encryptedNotes = encrypt(d.notes);
    await pool.query(
      `INSERT INTO mood_entries
         (entry_id, user_id, entry_date, entry_time,
          mood_score, energy_level, stress_level, sleep_quality, sleep_hours,
          anxiety_level, social_interaction_quality, notes, activities, triggers, is_encrypted)
       VALUES (uuid_generate_v4(), $1,
               CURRENT_DATE - ($2::int) * INTERVAL '1 day',
               '20:00:00',
               $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, TRUE)`,
      [
        userId, d.day,
        d.mood, d.energy, d.stress, d.sleep_q, d.sleep_h, d.anxiety, d.social,
        encryptedNotes,
        JSON.stringify(d.activities), JSON.stringify(d.triggers)
      ]
    );
    console.log(`  day -${d.day}: mood=${d.mood} energy=${d.energy} sleep=${d.sleep_h}h ✓`);
  }
};

// ─── Stage 3: run a short Luna conversation (via the API) ────────────────────
const runLunaChat = async (token) => {
  console.log('\nRunning Luna conversation (3 turns)...');
  const messages = [
    "I've been feeling pretty drained this week and not sleeping well.",
    "Work has been overwhelming and my mind keeps racing at night.",
    "What is something small I could try to unwind in the evenings?"
  ];
  for (const message of messages) {
    const res = await postJson('/chatbot/chat', { message }, token);
    if (res.status >= 200 && res.status < 300) {
      console.log(`  → "${message.slice(0, 55)}..." ✓`);
    } else {
      console.warn(`  → FAILED (${res.status})`, res.data);
    }
  }
};

// ─── Stage 4: trigger insights generation (via the API) ──────────────────────
const generateInsights = async (token) => {
  console.log('\nGenerating insights...');
  const res = await postJson('/insights/generate', {}, token);
  if (res.status >= 200 && res.status < 300) {
    console.log('  ✓ insights generated');
  } else {
    console.warn(`  FAILED (${res.status})`, res.data);
  }
};

// ─── Main ────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log('=== Mindspace demo-data seeder ===');
  console.log(`API base: ${BASE}\n`);

  try {
    const user = await getOrCreateUser();
    console.log(`Demo user ${user.isNew ? 'created' : 'already exists'}.`);
    console.log(`  userId: ${user.userId}`);

    await seedMoodEntries(user.userId);
    await runLunaChat(user.token);
    await generateInsights(user.token);

    console.log('\n=== Done. Log in with: ===');
    console.log(`  Email:    ${DEMO.email}`);
    console.log(`  Password: ${DEMO.password}`);
    console.log('\nThen capture screenshots (Chrome → F12 → Ctrl+Shift+P → "Capture full size screenshot"):');
    console.log('  /dashboard         → docs/screenshots/dashboard.png');
    console.log('  /mood              → docs/screenshots/mood-entry.png');
    console.log('  /chatbot           → docs/screenshots/luna-chatbot.png');
    console.log('  /insights          → docs/screenshots/insights.png');
    console.log('  /crisis-resources  → docs/screenshots/crisis-resources.png');
  } catch (err) {
    console.error('\nSeed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
