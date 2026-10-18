import type { Page } from '@playwright/test';

/**
 * Clicks a titlebar action wherever it currently is.
 *
 * The bar distributes its actions and folds the tail into `More actions` when
 * it measures an overflow — there is no breakpoint to pin. The action is the
 * same one either way, so the spec follows it instead of assuming a width.
 */
export const clickBarAction = async (page: Page, name: string) => {
  const banner = page.getByRole('banner');
  const direct = banner.getByRole('button', { name, exact: true });
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    return;
  }
  await banner.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
};
