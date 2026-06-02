#!/usr/bin/env node
/**
 * Automated README screenshot capture using Playwright.
 *
 * Logs in as the seeded demo user, navigates to each documented page,
 * captures a full-page PNG, and saves it to docs/screenshots/ with the
 * exact filenames the README references.
 *
 * Re-runnable: re-capturing overwrites the existing files (so post-UI-change
 * refreshes are one command). Could be wired into CI later.
 *
 * Prerequisites (one-time setup):
 *   cd frontend
 *   npm install                       # picks up the playwright devDep
 *   npx playwright install chromium   # downloads ~150 MB browser binary
 *
 * Live prerequisites (every run):
 *   - Backend running              (cd backend && npm run dev)
 *   - Frontend running             (cd frontend && npm run dev)
 *   - Demo user seeded             (node backend/scripts/seed-demo-data.js)
 *
 * Usage (from the frontend folder):
 *   npm run screenshots
 *
 * Optional overrides:
 *   FRONTEND_URL=http://localhost:3000 npm run screenshots
 *   SEED_DEMO_EMAIL=other@user npm run screenshots
 */
/* eslint-disable no-console */

import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const FRONTEND      = process.env.FRONTEND_URL      || 'http://localhost:5173';
const DEMO_EMAIL    = process.env.SEED_DEMO_EMAIL    || 'demo@mindspace.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'DemoMindspace!2026';
const OUT_DIR       = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');

const VIEWPORT = { width: 1440, height: 900 };

// Pages to capture. `afterNav` runs after the page settles; used here to
// open the Luna chat panel before snapshotting.
const PAGES = [
  { route: '/dashboard',         file: 'dashboard.png'        },
  { route: '/mood-tracker',      file: 'mood-entry.png'       },
  { route: '/insights',          file: 'insights.png'         },
  { route: '/crisis-resources',  file: 'crisis-resources.png' },
  {
    route: '/dashboard',
    file:  'luna-chatbot.png',
    // Luna is a floating widget on every protected page. Try common
    // trigger selectors; if none match, capture the dashboard with the
    // floating button visible.
    afterNav: async (page) => {
      const candidates = [
        'button:has-text("Luna")',
        'button[aria-label*="Luna" i]',
        'button[aria-label*="chat" i]',
        '[data-testid="luna-trigger"]',
        'button:has-text("Chat")'
      ];
      for (const sel of candidates) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0) {
          try {
            await btn.click({ timeout: 2_000 });
            await page.waitForTimeout(800); // let chat panel animate in
            return;
          } catch (_) { /* try the next selector */ }
        }
      }
      console.warn('  ! Luna trigger not found — capturing dashboard with floating widget visible');
    }
  }
];

const login = async (page) => {
  console.log(`Logging in as ${DEMO_EMAIL}...`);
  await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle', timeout: 15_000 });
  await page.fill('#email',    DEMO_EMAIL);
  await page.fill('#password', DEMO_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 10_000 }),
    page.click('button[type="submit"]')
  ]);
  console.log('  ✓ logged in');
};

const captureAll = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('=== Mindspace screenshot capture ===');
  console.log(`Frontend : ${FRONTEND}`);
  console.log(`Output   : ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2  // sharper screenshots on hi-DPI README readers
  });
  const page = await context.newPage();

  try {
    await login(page);

    for (const p of PAGES) {
      console.log(`Capturing ${p.file}...`);
      try {
        await page.goto(`${FRONTEND}${p.route}`, { waitUntil: 'networkidle', timeout: 15_000 });
      } catch (e) {
        // networkidle can stall on long-polling sockets; fall back to domcontentloaded.
        await page.goto(`${FRONTEND}${p.route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await page.waitForTimeout(1_500);
      }
      await page.waitForTimeout(800); // settle animations
      if (p.afterNav) await p.afterNav(page);
      await page.screenshot({
        path: path.join(OUT_DIR, p.file),
        fullPage: true
      });
      console.log(`  ✓ ${p.file}`);
    }

    console.log(`\nAll screenshots saved to ${OUT_DIR}`);
    console.log('Commit them with:');
    console.log('  git add docs/screenshots && git commit -m "Add app screenshots" && git push');
  } finally {
    await context.close();
    await browser.close();
  }
};

captureAll().catch((err) => {
  console.error('\nScreenshot capture failed:', err.message);
  process.exit(1);
});
