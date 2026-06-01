#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 * Usage:
 *   node backend/scripts/generate-vapid.js
 *
 * Copy the printed values into your backend/.env file (NEVER commit them).
 *
 * Keys are PER-DEPLOYMENT and generated ONCE. Rotating them invalidates
 * every existing browser subscription — users will need to re-grant
 * notification permission.
 */
/* eslint-disable no-console */

let webpush;
try {
  // eslint-disable-next-line global-require
  webpush = require('web-push');
} catch (err) {
  console.error('Cannot find module "web-push". Install with: npm install web-push');
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('VAPID key pair generated. Add these to your backend/.env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');
console.log('Also set VAPID_SUBJECT to a mailto: link or HTTPS URL identifying');
console.log('your service, for example:');
console.log('  VAPID_SUBJECT=mailto:you@example.com');
console.log('');
console.log('Never commit these keys.');
