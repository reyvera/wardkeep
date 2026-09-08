import { expect, test, type Page } from '@playwright/test';

const password = 'E2ePassword123!';
const email = `launch-e2e-${Date.now()}@wardkeep.test`;
const accountName = 'E2E Launch Checking';
const merchant = 'E2E Launch Groceries';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/brief$/);
}

test.describe.serial('launch smoke journey', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only launch journey');
  });

  test('registers and preserves a session across refresh', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/brief$/);
    await page.reload();
    await expect(page).toHaveURL(/\/brief$/);
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  });

  test('logout does not restore a session after refresh', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('keeps the mobile navigation anchored while content scrolls', async ({ page }) => {
    await login(page);
    await page.goto('/brief');

    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(nav).toBeVisible();
    const before = await nav.boundingBox();
    expect(before).not.toBeNull();

    const scrollTop = await page.locator('main').evaluate((element) => {
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      spacer.setAttribute('data-e2e-scroll-spacer', '');
      element.append(spacer);
      element.scrollTo(0, element.scrollHeight);
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    await page.waitForTimeout(150);

    const after = await nav.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.y + after!.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog', { name: 'More navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close more navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'More navigation' })).toBeHidden();
  });

  test('persists an account, transaction, and budget after refresh', async ({ page }) => {
    await login(page);
    await page.goto('/accounts');
    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByPlaceholder('e.g. Chase Checking').fill(accountName);
    await page.getByPlaceholder('0.00').fill('1000');
    await page.getByRole('button', { name: 'Save Account' }).click();
    await expect(page.getByText(accountName, { exact: true })).toBeVisible();

    await page.goto('/transactions');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByPlaceholder('e.g. Walmart').fill(merchant);
    await page.getByPlaceholder('0.00').fill('42.50');
    const transactionForm = page
      .locator('form')
      .filter({ has: page.getByPlaceholder('e.g. Walmart') });
    await transactionForm.locator('select').nth(1).selectOption({ label: accountName });
    await transactionForm.locator('select').nth(2).selectOption({ label: 'Food & Dining' });
    await page.getByRole('button', { name: 'Save Transaction' }).click();
    const merchantEntry = page.getByText(merchant, { exact: true });
    await merchantEntry.scrollIntoViewIfNeeded();
    await expect(merchantEntry).toBeVisible();

    await page.reload();
    await merchantEntry.scrollIntoViewIfNeeded();
    await expect(merchantEntry).toBeVisible();
    await page.goto('/accounts');
    await expect(page.getByText(accountName, { exact: true })).toBeVisible();

    await page.goto('/budget');
    await page.getByRole('button', { name: 'Create Budget' }).click();
    const budgetForm = page.locator('form').filter({ has: page.getByPlaceholder('Amount') });
    await budgetForm.locator('select').selectOption({ label: 'Food & Dining' });
    await budgetForm.getByPlaceholder('Amount').fill('100');
    await budgetForm.getByRole('button', { name: 'Save Budget' }).click();
    await expect(page.getByText('$100.00', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('$100.00', { exact: true }).first()).toBeVisible();
  });

  test('creates and lists a manual encrypted backup', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    const backupSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'BACKUP & RECOVERY' }),
    });
    const passphraseInputs = backupSection.getByPlaceholder(/backup passphrase/i);
    await passphraseInputs.nth(0).fill('E2E backup passphrase');
    await passphraseInputs.nth(1).fill('E2E backup passphrase');
    await backupSection.getByRole('button', { name: 'Create backup' }).click();
    await expect(backupSection.getByText('Manual backup created.')).toBeVisible();
    await expect(backupSection.getByText('Manual backup', { exact: true })).toBeVisible();
  });
});
