import type { Page } from '@playwright/test';

/**
 * Clicks a titlebar action where it lives now: inside the collector menu.
 *
 * The bar keeps one entry point — "Menu" — holding the document, output and
 * system actions in three separator-bound groups. Every action is one
 * deliberate click away; there is no width-dependent fold to follow anymore.
 */
export const clickBarAction = async (page: Page, name: string) => {
  await page.getByRole('banner').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
};
