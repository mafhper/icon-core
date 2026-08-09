import { test, expect } from '@playwright/test';

test('promo has CTA to the online workspace', async ({ page }) => {
  await page.goto('/icon-core/');
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Try Online' })
  ).toHaveAttribute('href', '/icon-core/app/#/workspaces');
});
