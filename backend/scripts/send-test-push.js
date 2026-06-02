#!/usr/bin/env node
/**
 * Send a test Web Push notification to a subscribed user — end-to-end check.
 *
 * Usage:
 *   node backend/scripts/send-test-push.js                  # list users with subscriptions
 *   node backend/scripts/send-test-push.js <userId>         # send a test push to that user
 *
 * Exits 0 on success (notification dispatched, or list shown).
 * Exits 1 on usage / config error.
 *
 * Validates the full pipeline VAPID env -> webPushService -> web-push lib
 * -> the browser endpoint -> the service worker -> the rendered notification.
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const webPushModule = require('../src/services/webPushService');

const PAYLOAD = {
  title: 'Mindspace test',
  body:  'If you can see this, Web Push is working end-to-end.',
  data:  { event: 'test:push', source: 'send-test-push.js' }
};

const listSubscribers = async () => {
  const result = await pool.query(
    `SELECT user_id,
            COUNT(*) AS endpoint_count,
            MAX(last_used_at) AS most_recent_use
       FROM push_subscriptions
       GROUP BY user_id
       ORDER BY most_recent_use DESC NULLS LAST
       LIMIT 20`
  );
  if (result.rows.length === 0) {
    console.log('No push subscriptions exist yet.');
    console.log('First opt in via the frontend: Settings -> Preferences -> Enable push notifications.');
    return;
  }
  console.log('Users with push subscriptions:');
  console.log('');
  for (const row of result.rows) {
    console.log(`  user_id=${row.user_id}  endpoints=${row.endpoint_count}  last_used=${row.most_recent_use || 'never'}`);
  }
  console.log('');
  console.log('Send a test notification with:');
  console.log('  node backend/scripts/send-test-push.js <userId>');
};

const sendPush = async (userId) => {
  const service = webPushModule.getInstance();
  if (!service.isEnabled()) {
    console.error('Web Push is disabled.');
    console.error('Check VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in backend/.env.');
    process.exitCode = 1;
    return;
  }
  console.log(`Sending test push to user ${userId}...`);
  const result = await service.sendToUser(userId, PAYLOAD);
  console.log('');
  console.log('Result:');
  console.log(`  sent   : ${result.sent}`);
  console.log(`  pruned : ${result.pruned}   (stale endpoints removed)`);
  console.log(`  failed : ${result.failed}`);
  if (result.sent > 0) {
    console.log('');
    console.log('Notification dispatched. Check your browser / OS notification tray.');
  } else if (result.sent === 0 && result.pruned === 0 && result.failed === 0) {
    console.log('');
    console.log('No subscriptions for that user. Have they opted in via Settings yet?');
  }
};

const main = async () => {
  try {
    const userId = process.argv[2];
    if (!userId) {
      await listSubscribers();
    } else {
      await sendPush(userId);
    }
  } finally {
    await pool.end();
  }
};

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
