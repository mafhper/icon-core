import type { Page } from '@playwright/test';

/**
 * Clicks a titlebar action where it lives now: inside the studio menubar.
 *
 * The bar keeps four PT slots — Arquivo, Editar, Exibir, Sobre — while the
 * zone fits, and swaps them for the hamburger once the zone is measured
 * overflowing (never a fixed window breakpoint; see `StudioMenus`). This
 * helper reads which presentation is on screen and takes the row in either
 * one, so the call-site names the action, not the shape of the bar.
 */
export const clickBarAction = async (page: Page, menu: string, name: string) => {
  const banner = page.getByRole('banner');
  const hamburger = banner.getByRole('button', { name: 'Main menu' });
  if (await hamburger.isVisible()) {
    await hamburger.click();
    await page.getByRole('menu', { name: 'Main menu' }).getByRole('menuitem', { name }).click();
    return;
  }
  await banner.getByRole('menuitem', { name: menu }).click();
  await page.getByRole('menu').getByRole('menuitem', { name }).click();
};
