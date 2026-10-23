import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * The landing page promises an offline-first product, and the page itself was the last
 * place still asking a CDN for its typefaces: Manrope, Sora and IBM Plex Mono all came
 * from `fonts.googleapis.com` / `fonts.gstatic.com`. Without a network the page silently
 * fell back, which is the failure mode no unit test sees — the `@font-face` stays in the
 * CSS and the font simply never arrives.
 *
 * So the assertion is made where the request happens: in the browser.
 *
 * - Every request whose URL leaves the origin is collected. **Data** is allowed (the
 *   release dock asks `api.github.com` and has its own offline copy); **rendering** —
 *   documents, stylesheets, scripts, fonts, images, media, manifest — is not, because a
 *   face that does not arrive changes the layout and a stylesheet that does not arrive
 *   changes everything.
 * - `document.fonts` then proves the three families actually resolve. A page that removed
 *   the `<link>` but forgot `@font-face` would pass the request check and fail this one.
 */

const FONT_FILE = /(Manrope|Sora|IBMPlexMono)-[^/]*\.woff2$/;

/** Resource types that must never leave the origin: without them the page renders wrong. */
const RENDER_BLOCKING_TYPES = new Set([
  'document',
  'stylesheet',
  'script',
  'font',
  'image',
  'media',
  'manifest'
]);

const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;

function collect(page: Page, origin: string) {
  const externalRendering: string[] = [];
  const externalData: string[] = [];
  const fontHostHits: string[] = [];
  const fonts: string[] = [];

  page.on('request', (request: Request) => {
    const url = request.url();
    if (!/^https?:/i.test(url)) return; // data: and blob: never touch the network
    if (FONT_FILE.test(new URL(url).pathname)) fonts.push(url);

    if (FONT_HOSTS.test(url)) fontHostHits.push(url);
    if (url.startsWith(origin)) return;

    if (RENDER_BLOCKING_TYPES.has(request.resourceType())) externalRendering.push(url);
    else externalData.push(url);
  });

  return { externalRendering, externalData, fontHostHits, fonts };
}

test('the landing page renders without asking a CDN for fonts', async ({ page, baseURL }) => {
  const origin = `${baseURL}/`;
  const seen = collect(page, origin);

  await page.goto('/icon-core/');
  await page.evaluate(() => document.fonts.ready);

  /*
   * Read *before* the explicit `document.fonts.load` calls below, because those force
   * every face and erase the only signal that matters here: a face that the page never
   * composes text with stays `unloaded`. So a Sora face already `loaded` at this point
   * was fetched because a heading renders in it.
   *
   * The recovery path this guards is subtle. Re-adding the CDN `<link>` would be caught,
   * and so would deleting the `@font-face`. What slipped through was the opposite: the
   * declarations present and correct, the headings still composing in the body face —
   * Manrope is first in `body`, and Sora is only its *fallback*, so the page looks
   * typographically fine and simply never uses the display face it ships.
   */
  const rendered = await page.evaluate(() => {
    /** The family the browser actually composes with is the first in the resolved stack. */
    const primary = (stack: string) =>
      stack
        .split(',')[0]
        ?.replace(/["']/g, '')
        .trim() ?? '';

    const headings = Array.from(document.querySelectorAll('h1, h2')).map((heading) => ({
      tag: heading.tagName.toLowerCase(),
      text: heading.textContent?.trim().slice(0, 48) ?? '',
      primary: primary(getComputedStyle(heading).fontFamily)
    }));

    const soraFaces = Array.from(document.fonts)
      .filter((face) => face.family.replace(/["']/g, '') === 'Sora')
      .map((face) => face.status);

    return { headings, soraFaces };
  });

  // A vacuous loop is the classic way this assertion dies: no heading found, nothing
  // checked, green forever. The page has exactly one H1 and at least one section H2.
  const h1s = rendered.headings.filter((heading) => heading.tag === 'h1');
  const h2s = rendered.headings.filter((heading) => heading.tag === 'h2');
  expect(h1s.map((heading) => heading.text), 'the hero H1 was not found').toHaveLength(1);
  expect(h2s.length, 'no section H2 was found').toBeGreaterThan(0);

  /*
   * `toContain('Sora')` would pass on an unwired heading, because `body` lists Sora as a
   * fallback — the assertion has to name the primary family. This is the same shape as
   * the mono check further down, just stricter: the mono element has its own class, and
   * the heading is only distinguishable by which family comes first.
   */
  for (const heading of rendered.headings) {
    expect(
      heading.primary,
      `<${heading.tag}> "${heading.text}" does not compose in Sora`
    ).toBe('Sora');
  }

  // And the face was genuinely fetched as a result — one `loaded` Sora face before any
  // explicit load means the rendered headings pulled it, not just the stylesheet.
  expect(rendered.soraFaces, 'no Sora face was loaded by the rendered page').toContain('loaded');

  // Every family the CSS promises, explicitly fetched: `document.fonts.load` asks the
  // browser to resolve the face, so a missing or remote `src` shows up here instead of
  // hiding until the first text that happens to use it.
  const loaded = await page.evaluate(async () => {
    const specs = ['400 16px Manrope', '600 32px Sora', '400 12px "IBM Plex Mono"'];
    const faces = await Promise.all(specs.map((spec) => document.fonts.load(spec)));
    return specs.map((spec, index) => ({
      spec,
      count: faces[index].length,
      statuses: faces[index].map((face) => face.status)
    }));
  });

  for (const family of loaded) {
    expect(family.count, `${family.spec} resolved to no face`).toBeGreaterThan(0);
    expect(family.statuses, `${family.spec} is not loaded`).not.toContain('error');
  }

  // The proof the page is self-hosted: each family was fetched, and every font file came
  // from the page's own origin.
  for (const family of ['Manrope', 'Sora', 'IBMPlexMono']) {
    const served = seen.fonts.filter((url) => new URL(url).pathname.includes(`/${family}-`));
    expect(served.length, `no local ${family} woff2 was requested`).toBeGreaterThan(0);
  }

  expect(seen.fontHostHits, `font CDN requests: ${seen.fontHostHits.join(', ')}`).toEqual([]);
  expect(
    seen.externalRendering,
    `rendering subresources left the origin: ${seen.externalRendering.join(', ')}`
  ).toEqual([]);

  // The faces are declared, but that alone would be satisfied by an unused `@font-face`.
  // These are the two families the page actually composes with, so the computed stack
  // proves the declarations are wired to the elements that render text.
  const used = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    mono: getComputedStyle(document.querySelector('.font-mono') as Element).fontFamily
  }));
  expect(used.body).toContain('Manrope');
  expect(used.mono).toContain('IBM Plex Mono');

  // And the emitted HTML carries no font link either: a `<link>` that is never fetched
  // because nothing needs it is still a network dependency waiting to come back.
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[href]')).map((link) => link.getAttribute('href') ?? '')
  );
  expect(links.filter((href) => FONT_HOSTS.test(href))).toEqual([]);

  // `externalData` is not empty in a networked run (the release dock), and that is fine —
  // it is asserted only so a silent change in *what* leaves the origin is visible in the
  // report instead of being swallowed by the aggregate.
  expect(seen.externalData.every((url) => url.startsWith('https://api.github.com/'))).toBe(true);
});
