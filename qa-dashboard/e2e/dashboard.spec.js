import { test, expect } from '@playwright/test';

test.describe('Dashboard loading', () => {
  test('root redirects to /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard page renders header', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Testmo Dashboard');
  });

  test('dashboard view selector is visible', async ({ page }) => {
    await page.goto('/dashboard');
    const selector = page.locator('select').nth(1);
    await expect(selector).toBeVisible();
  });

  test('dark theme toggle is present', async ({ page }) => {
    await page.goto('/dashboard');
    // The input is CSS-hidden; the visible element is the .slider span
    const slider = page.locator('.theme-switch .slider').first();
    await expect(slider).toBeVisible();
  });

  test('footer shows copyright', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('footer')).toContainText('Neo-Logix');
  });
});

test.describe('URL-based navigation', () => {
  test('navigating to /tv loads TV view', async ({ page }) => {
    await page.goto('/tv');
    await expect(page).toHaveURL(/\/tv/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigating to /quality loads Dashboard3', async ({ page }) => {
    await page.goto('/quality');
    await expect(page).toHaveURL(/\/quality/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('unknown route redirects to /dashboard', async ({ page }) => {
    await page.goto('/unknown-route-xyz');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('backend status indicator is present', async ({ page }) => {
    await page.goto('/dashboard');
    const status = page.locator('.backend-status');
    await expect(status).toBeVisible();
  });
});
