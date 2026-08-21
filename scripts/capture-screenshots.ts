/**
 * Captures screenshots of all major UI pages at desktop and mobile viewports.
 * Used for embedding visual references in docs and README.
 *
 * Prerequisites:
 *   - Playwright browsers installed: `npx playwright install chromium`
 *   - API running on port 4000
 *   - Web frontend running on port 3000
 *   - Demo user seeded: `pnpm db:seed:demo`
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts
 *
 * Output:
 *   docs/screenshots/desktop/*.png
 *   docs/screenshots/mobile/*.png
 */

import { chromium, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const DEMO_EMAIL = 'demo@wardkeep.app';
const DEMO_PASSWORD = 'DemoPassword123';

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 390, height: 844 }, // iPhone 14 Pro
} as const;

/**
 * Pages to capture. Each entry has a human-friendly name and the URL path.
 * Pages are visited in this order after login.
 */
const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'accounts', path: '/accounts' },
  { name: 'transactions', path: '/transactions' },
  { name: 'budget', path: '/budget' },
  { name: 'categories', path: '/categories' },
  { name: 'recurring', path: '/recurring' },
  { name: 'debt', path: '/debt' },
  { name: 'rules', path: '/rules' },
  { name: 'import', path: '/import' },
  { name: 'bank-connections', path: '/bank-connections' },
  { name: 'chat', path: '/chat' },
  { name: 'settings', path: '/settings' },
];

const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

/**
 * Logs in as the demo user and returns an authenticated page.
 */
async function login(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('#email', DEMO_EMAIL);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  return page;
}

/**
 * Captures a screenshot of the given page at the current viewport size.
 */
async function captureScreen(page: Page, pageName: string, device: string): Promise<void> {
  const dir = path.join(OUTPUT_DIR, device);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${pageName}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  ✓ ${device}/${pageName}.png`);
}

async function main(): Promise<void> {
  console.log('🖼️  WardKeep Screenshot Capture');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Output:   ${OUTPUT_DIR}`);
  console.log('');

  const browser = await chromium.launch();

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    console.log(`📱 Capturing ${device} (${viewport.width}x${viewport.height})...`);

    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: device === 'mobile' ? 3 : 2, // Retina-quality captures
    });

    const page = await login(context);

    for (const { name, path: pagePath } of PAGES) {
      try {
        await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle' });
        // Give charts and animations a moment to render
        await page.waitForTimeout(1000);
        await captureScreen(page, name, device);
      } catch (err) {
        console.error(`  ✗ ${device}/${name}.png — ${(err as Error).message}`);
      }
    }

    await context.close();
    console.log('');
  }

  await browser.close();
  console.log('✅ Done! Screenshots saved to docs/screenshots/');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
