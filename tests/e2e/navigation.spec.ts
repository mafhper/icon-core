import { test, expect } from '@playwright/test';

/**
 * The header is the only navigation the landing page has, and its labels are part of the
 * redesign — the v1 "Try Online" CTA is gone, replaced by the section docks and the
 * "Abrir no navegador" link. A spec pinned to the old label failed against a page that was
 * working: it reported the CTA as missing instead of reporting what the bar now promises.
 *
 * So the contract asserted here is behavioural: every link the bar renders points at a
 * section that exists on the page, clicking it lands there, and the deep links that are
 * already in the wild (`#baixar` and the legacy `#desktop`) still resolve after mount.
 */

const DEEPLINK_ALIASES = [
  { hash: '#baixar', landmark: '#baixar' },
  // `#desktop` aliased the download block in v1; the alias must still land on that dock.
  { hash: '#desktop', landmark: '#baixar' }
] as const;

test('header offers the page docks and no v1 CTA', async ({ page }) => {
  await page.goto('/icon-core/');

  const banner = page.getByRole('banner');
  const hrefs = await banner
    .getByRole('navigation', { name: 'Seções' })
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

  expect(hrefs).toEqual(expect.arrayContaining(['#plataformas', '#baixar']));
  await expect(banner.getByRole('link', { name: 'Try Online' })).toHaveCount(0);

  // The replacement for the v1 CTA: the bar opens the web app at its deployed path.
  await expect(banner.getByRole('link', { name: 'Abrir no navegador' })).toHaveAttribute(
    'href',
    /\/icon-core\/app\/$/
  );
});

test('every header link lands on the section it names', async ({ page }) => {
  await page.goto('/icon-core/');

  const nav = page.getByRole('banner').getByRole('navigation', { name: 'Seções' });
  const links = await nav.getByRole('link').evaluateAll((items) =>
    items.map((item) => ({ href: item.getAttribute('href') ?? '', name: item.textContent?.trim() ?? '' }))
  );
  expect(links.length).toBeGreaterThan(0);

  for (const { href, name } of links) {
    // A nav link to nowhere is a broken promise, not a placeholder.
    expect(href.startsWith('#')).toBe(true);
    await page.goto('/icon-core/');
    const target = page.locator(href);
    await expect(target, `#${href.slice(1)} should exist once`).toHaveCount(1);

    await nav.getByRole('link', { name, exact: true }).click();
    await expect(target, `${href} should come into view`).toBeInViewport();
  }
});

test('deep links resolve to the download dock', async ({ page }) => {
  for (const { hash, landmark } of DEEPLINK_ALIASES) {
    await page.goto(`/icon-core/${hash}`);

    await expect(page.locator(hash), `${hash} should exist once`).toHaveCount(1);
    await expect(page.locator(landmark), `${hash} should land on ${landmark}`).toBeInViewport();
  }
});
