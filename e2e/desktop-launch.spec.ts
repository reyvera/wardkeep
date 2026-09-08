import { expect, test, type Page } from '@playwright/test';

const password = 'E2ePassword123!';
const email = `desktop-e2e-${Date.now()}@wardkeep.test`;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/brief$/);
}

test.describe.serial('desktop launch smoke journey', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only launch journey');
  });

  test('registers, refreshes, and navigates with the desktop sidebar', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/brief$/);
    await page.reload();
    await expect(page).toHaveURL(/\/brief$/);

    const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();

    for (const [label, path] of [
      ['Accounts', '/accounts'],
      ['Transactions', '/transactions'],
      ['Budget', '/budget'],
      ['Settings', '/settings'],
    ] as const) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('keeps the desktop sidebar pinned while the page scrolls', async ({ page }) => {
    await login(page);
    await page.goto('/brief');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    const before = await sidebar.boundingBox();
    expect(before).not.toBeNull();

    await page.locator('main').evaluate((element) => {
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      spacer.setAttribute('data-e2e-scroll-spacer', '');
      element.append(spacer);
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);

    const after = await sidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);
  });

  test('clears the desktop session on logout', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });
});
