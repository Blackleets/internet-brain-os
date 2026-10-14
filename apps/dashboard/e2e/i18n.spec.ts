import { expect, test } from '@playwright/test';

test.describe('language', () => {
  test.use({ locale: 'en-US' });
  test('an English browser gets the English UI by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Efesto areas' })).toContainText('Workspace');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('language (unsupported locale)', () => {
  test.use({ locale: 'ja-JP' });
  test('falls back to English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Efesto areas' })).toContainText('Finds');
  });
});
