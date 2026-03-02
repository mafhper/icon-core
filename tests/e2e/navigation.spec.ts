import { test, expect } from '@playwright/test';

test('promo has CTA to app path', async ({ page }) => {
  await page.goto('/icon-core/');
  await expect(page.getByRole('link', { name: /launch app/i })).toHaveAttribute('href', '/icon-core/app/');
});
