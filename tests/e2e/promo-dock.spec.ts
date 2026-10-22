import { test, expect, type Page } from '@playwright/test';

/**
 * The appearance dock is the landing page's only "preview" control: four tiles with a glyph and a
 * label, hosted by the hero panel and by the editor showcase. Beside it in the hero sits the frame
 * radius control, and the two are one row.
 *
 * That row is the contract, and it is the third attempt at this widget:
 *   1. a **viewport** grid (`grid-cols-2 sm:flex`) — at a 1258 px window `sm:flex` read "wide, one
 *      row" while the hero's dock column was 149 px, so four ~34 px tiles held a ~67 px word;
 *   2. a **container** ladder of 2 and then 1 column — honest about the box, but it gave up the one
 *      thing the page is reproducing: the mockup's dock is four tiles in a row, always;
 *   3. a **container switch** that stacked the card below 576 px — which is the mockup's `sm:` rule
 *      applied to the card's width, and it turned the 1024 px hero (a 356 px card) into radius on
 *      top, dock below.
 *
 * The mockup (`mockup-lovable-shader/main/src/components/icon-core/Hero.tsx`) is
 * `grid ... sm:grid-cols-[minmax(0,13rem)_1px_minmax(0,1fr)]`: radius control | 1 px separator |
 * dock. The widths the port has to carry are not the mockup's (`max-w-xl` = 576 px), so the port
 * compresses instead of reflowing: the radius column is `minmax(0,13rem)` and gives width up first,
 * the dock column has a floor of 11.25rem, and the gaps step 8 → 12 → 20 px. At 576 px the card is
 * the mockup's to the pixel: radius 208, separator 1, dock 293, tiles 70.3, labels 11 px, gaps 4.
 *
 * What is asserted here:
 *   - the card is one row at every width: the dock starts after the radius block and shares its
 *     horizontal band, and the separator is a 1 px vertical line between them;
 *   - the dock is one row of four tiles in both hosts, with equal widths;
 *   - every label is whole: no truncation, a visible gap to its neighbour, inside the card;
 *   - the tile metrics, at the mockup's values when the dock has the mockup's width and at the
 *     compressed ones (10 px label, 4 px horizontal padding, the mockup's 4 px gap) when the card
 *     squeezes it;
 *   - the plate inside each tile is a **thumb**: `THUMB_RADIUS` — 12 % of the 512 viewBox, written
 *     `61.4` by the path formatter, i.e. 4.56 px on the hero's 38 px plate and 4.08 px on the
 *     editor's 34 px one — and never the frame's 130/512 (25.39 %) that would paint 9.65 / 8.63 px;
 *   - the four preset ticks sit where the thumb sits for that radius, and Enter on a focused tick
 *     sets the radius — the keyboard path a visitor has instead of the mouse.
 *
 * These assertions run in the browser because the defect is layout: jsdom computes no geometry, and
 * reading class names proves nothing about a line that wrapped.
 */

const DOCK = '[role="radiogroup"][aria-label="Aparência do ícone e do site"]';
const CARD = '[data-testid="widget-card"]';
const LABELS = ['Default', 'Light', 'Dark', 'Mono'];

/** The mockup's dock width (`max-w-xl` card, 576 px, minus 13rem, 1 px and two 20 px gaps). */
const WIDE_DOCK = 240;

/** The mockup's tile metrics, in CSS px: `gap-1` between tiles, `gap-1.5` inside one. */
const WIDE = { gap: 4, padding: '8px 8px 6px', font: '11px' };
/** The compressed tile, once the dock is squeezed under `WIDE_DOCK`: the gap stays the mockup's. */
const NARROW = { gap: 4, padding: '8px 4px 6px', font: '10px' };
const TILE_GAP = 6;

/** Rail thumb diameter (`SLIDER_THUMB_PX`): a mark is placed half a thumb inside the rail's box. */
const THUMB = 16;

/** The four presets as a share of the rail, literals from the scale (24/512 over 50 → 9.375 %). */
const PRESET_FRACTIONS = [0, 0.09375, 0.45, 1];

/**
 * The thumb radius, `THUMB_RADIUS` at 12 % of the 512 viewBox: a 61.44 corner, written `61.4` by
 * the path formatter's single decimal. At the two plate sizes the page draws, that is 4.56 px in the
 * hero and 4.08 px in the editor — where the frame's own 130/512 would be 9.65 and 8.63 px.
 */
const PLATE_ARC = 61.4;
const PLATE_PX: Record<string, number> = { top: 4.56, interface: 4.08 };

type Tile = {
  name: string;
  width: number;
  top: number;
  font: string;
  gap: number;
  padding: string;
  labelWidth: number;
  labelScroll: number;
  labelClient: number;
  labelLeft: number;
  labelRight: number;
  left: number;
  /** The plate's corner: the path's own arc in the viewBox, and what it paints on screen. */
  plate: { arc: number | null; px: number | null };
};

type Dock = {
  instance: string;
  width: number;
  rows: number;
  gap: number;
  right: number;
  tiles: Tile[];
  card: {
    width: number;
    left: number;
    right: number;
    radius: { width: number; left: number; right: number; top: number; bottom: number };
    separator: { width: number; height: number; display: string };
    rail: { left: number; width: number } | null;
    ticks: number[];
  } | null;
};

type Measurement = { docks: Dock[]; overflowFromDock: string[] };

async function measure(page: Page, width: number): Promise<Measurement> {
  await page.setViewportSize({ width, height: 1400 });
  await page.goto('/icon-core/');
  await page.waitForTimeout(250);

  return page.evaluate(
    ({ selector, cardSelector }) => {
      const docks = [...document.querySelectorAll(selector)].map((dock) => {
        const dockRect = dock.getBoundingClientRect();
        const dockStyle = getComputedStyle(dock);
        const tiles = [...dock.querySelectorAll('[role="radio"]')].map((tile) => {
          const tileRect = tile.getBoundingClientRect();
          const tileStyle = getComputedStyle(tile);
          const label = [...tile.querySelectorAll('span')].at(-1)!;
          const labelRect = label.getBoundingClientRect();
          const glyph = tile.querySelector('svg')?.getBoundingClientRect() ?? null;
          const platePath = tile.querySelector('svg clipPath path')?.getAttribute('d') ?? '';
          const arc = /^M([\d.]+)/.exec(platePath);
          return {
            name: (tile.textContent ?? '').trim(),
            width: tileRect.width,
            top: Math.round(tileRect.top),
            font: getComputedStyle(label).fontSize,
            gap: parseFloat(tileStyle.rowGap) || 0,
            padding: [tileStyle.paddingTop, tileStyle.paddingRight, tileStyle.paddingBottom].join(' '),
            labelWidth: labelRect.width,
            labelScroll: label.scrollWidth,
            labelClient: label.clientWidth,
            labelLeft: labelRect.left,
            labelRight: labelRect.right,
            left: tileRect.left,
            plate: {
              arc: arc ? Number(arc[1]) : null,
              px: arc && glyph ? Number(((Number(arc[1]) / 512) * glyph.width).toFixed(2)) : null
            }
          };
        });

        const card = dock.closest(cardSelector);
        let cardData = null;
        if (card) {
          const cardRect = card.getBoundingClientRect();
          const radius = card.children[0].getBoundingClientRect();
          const separator = card.children[1];
          const separatorRect = separator.getBoundingClientRect();
          const rail = card.children[0].querySelector('input[type="range"]');
          const ticks = [...card.children[0].querySelectorAll('button[aria-label^="Raio "]')].map((button) => {
            const rect = button.getBoundingClientRect();
            return rect.left + rect.width / 2;
          });
          cardData = {
            width: cardRect.width,
            left: cardRect.left,
            right: cardRect.right,
            radius: { width: radius.width, left: radius.left, right: radius.right, top: radius.top, bottom: radius.bottom },
            separator: {
              width: separatorRect.width,
              height: separatorRect.height,
              display: getComputedStyle(separator).display
            },
            rail: rail ? { left: rail.getBoundingClientRect().left, width: rail.getBoundingClientRect().width } : null,
            ticks
          };
        }

        return {
          instance: dock.closest('section')?.id ?? 'editor',
          width: dockRect.width,
          rows: new Set(tiles.map((tile) => tile.top)).size,
          gap: parseFloat(dockStyle.columnGap) || 0,
          right: dockRect.right,
          tiles,
          card: cardData
        };
      });

      // The page has its own pre-existing horizontal overflow in the top bar (native-tooltip spans at
      // `left-[104%]`). What this contract owns is that the dock contributes none: nothing inside a
      // dock may extend past the viewport.
      const overflowFromDock: string[] = [];
      for (const dock of document.querySelectorAll(selector)) {
        for (const element of [dock, ...dock.querySelectorAll('*')]) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.right > window.innerWidth + 0.5) {
            overflowFromDock.push(`${dock.closest('section')?.id ?? 'editor'}: ${(element.textContent ?? '').slice(0, 24)}`);
          }
        }
      }

      return { docks, overflowFromDock };
    },
    { selector: DOCK, cardSelector: CARD }
  );
}

/** Distance between the text of two tiles on the same row; zero or less means overlap. */
function minLabelGap(tiles: Tile[]) {
  const rows = [...new Set(tiles.map((tile) => tile.top))];

  return Math.min(
    ...rows.map((top) => {
      const row = tiles.filter((tile) => tile.top === top);
      return Math.min(...row.slice(1).map((tile, index) => tile.labelLeft - row[index]!.labelRight));
    })
  );
}

// 320 is the narrowest supported phone, 355/360 the widths whose card is ~320 (where the owner
// compared the port to the mockup), 640/768/1024/1100 the widths where the hero's *card* is narrow
// while the window is not, and 1258/1280 the wide window whose hero column is `max-w-xl`. The dock
// expectation is derived from the width the card measured, so these numbers stay honest if the grid
// changes.
for (const width of [320, 355, 360, 640, 768, 1024, 1100, 1258, 1280] as const) {
  test(`the widget is one row, with the mockup's dock, at ${width}px`, async ({ page }) => {
    const { docks, overflowFromDock } = await measure(page, width);

    // Two instances share the component: the hero panel and the editor showcase.
    expect(docks.map((dock) => dock.instance).sort()).toEqual(['interface', 'top']);
    expect(overflowFromDock, 'the dock never pushes ink past the window').toEqual([]);

    const report: string[] = [];

    for (const dock of docks) {
      expect(dock.tiles.map((tile) => tile.name), `[${dock.instance}] the four labels changed`).toEqual(LABELS);

      // 1. The dock is one row of four, always — the mockup's `flex gap-1`, never a grid.
      if (dock.rows !== 1) {
        report.push(`[${dock.instance}] the dock painted ${dock.rows} rows in a ${dock.width.toFixed(1)}px slot; the mockup has one`);
      }
      const tileWidths = dock.tiles.map((tile) => tile.width);
      if (Math.max(...tileWidths) - Math.min(...tileWidths) > 0.5) {
        report.push(`[${dock.instance}] tiles are not equal: ${tileWidths.map((value) => value.toFixed(1)).join(' / ')}`);
      }

      // 2. The mockup's tile metrics at the mockup's width, and the compressed ones below it.
      const state = dock.width >= WIDE_DOCK ? WIDE : NARROW;
      if (dock.gap !== state.gap) {
        report.push(`[${dock.instance}] dock gap is ${dock.gap}px, expected ${state.gap}px at ${dock.width.toFixed(1)}px`);
      }
      for (const tile of dock.tiles) {
        if (tile.padding !== state.padding) {
          report.push(`[${dock.instance}] "${tile.name}" padding is ${tile.padding}, expected ${state.padding}`);
        }
        if (tile.font !== state.font) {
          report.push(`[${dock.instance}] "${tile.name}" label is ${tile.font}, expected ${state.font}`);
        }
        if (tile.gap !== TILE_GAP) {
          report.push(`[${dock.instance}] "${tile.name}" glyph-to-label gap is ${tile.gap}px, expected ${TILE_GAP}px`);
        }

        // 3. The label is whole: its scroll box is its client box, and it keeps a gap to its neighbour.
        if (tile.labelScroll > tile.labelClient + 1) {
          report.push(
            `[${dock.instance}] "${tile.name}" is truncated: label scrolls ${tile.labelScroll}px in ${tile.labelClient}px`
          );
        }
      }

      const gap = minLabelGap(dock.tiles);
      if (gap <= 1) report.push(`[${dock.instance}] labels on the same row are ${gap.toFixed(1)}px apart`);

      // 4. The plate is a thumb, not a miniature of the file: `THUMB_RADIUS` at 12 % — a 61.44
      // corner of the viewBox, written `61.4`, 4.56 px on the hero's 38 px plate and 4.08 px on
      // the editor's 34 px one. The frame's 130/512 would paint 9.65 / 8.63 px and, at 360 px, sit
      // on the tile's own corner.
      const platePx = PLATE_PX[dock.instance];
      for (const tile of dock.tiles) {
        if (tile.plate.arc !== PLATE_ARC) {
          report.push(`[${dock.instance}] "${tile.name}" plate arc is ${tile.plate.arc} of 512, expected ${PLATE_ARC}`);
        }
        if (platePx === undefined || tile.plate.px === null || Math.abs(tile.plate.px - platePx) > 0.05) {
          report.push(
            `[${dock.instance}] "${tile.name}" plate paints ${tile.plate.px}px of corner, expected ${platePx}px`
          );
        }
      }

      // 5. The labels stay inside the widget they belong to — the card in the hero, the dock when it
      // stands alone in the editor. A squeezed tile may let its label reach past its own border into
      // the gap beside it, which is what the mockup does at 320 px; it may not leave the card.
      const bounds = dock.card ?? { left: dock.tiles[0]!.left, right: dock.right };
      for (const tile of dock.tiles) {
        if (tile.labelLeft < bounds.left - 1 || tile.labelRight > bounds.right + 1) {
          report.push(
            `[${dock.instance}] "${tile.name}" paints outside its host: ` +
              `${tile.labelLeft.toFixed(1)}..${tile.labelRight.toFixed(1)} in ${bounds.left.toFixed(1)}..${bounds.right.toFixed(1)}`
          );
        }
      }

      // 6. The hero card, not the dock: radius | separator | dock on one line, never stacked.
      if (dock.card) {
        const { card } = dock;
        if (card.width > 576.5) {
          report.push(`[top] the card is ${card.width.toFixed(1)}px, wider than the mockup's max-w-xl`);
        }
        if (dock.tiles[0]!.left < card.radius.right) {
          report.push(
            `[top] the dock starts at ${dock.tiles[0]!.left.toFixed(1)}, before the radius block ends at ${card.radius.right.toFixed(1)}`
          );
        }
        if (dock.tiles[0]!.top > card.radius.bottom - 1) {
          report.push(
            `[top] the dock (top ${dock.tiles[0]!.top}) is below the radius block (bottom ${card.radius.bottom.toFixed(1)}): the card stacked`
          );
        }
        if (card.separator.display === 'none') {
          report.push('[top] the card has no separator between the radius block and the dock');
        }
        if (card.separator.width > 1.5) {
          report.push(`[top] the separator is ${card.separator.width}px wide, the mockup's is 1px`);
        }
        if (card.separator.height < 24) {
          report.push(`[top] the separator is ${card.separator.height}px tall; it should hold the row`);
        }

        // 7. The preset marks sit on the rail's own scale: a mark at fraction f is the thumb's centre
        // when the slider holds that preset, i.e. half a thumb inside the rail at each end.
        if (card.rail) {
          const expected = PRESET_FRACTIONS.map(
            (fraction) => card.rail!.left + THUMB / 2 + fraction * (card.rail!.width - THUMB)
          );
          const placed = card.ticks.map((center, index) => `${(center - expected[index]!).toFixed(1)}px`);
          if (card.ticks.length !== PRESET_FRACTIONS.length) {
            report.push(`[top] ${card.ticks.length} preset marks on the rail, expected ${PRESET_FRACTIONS.length}`);
          } else if (placed.some((offset) => Math.abs(parseFloat(offset)) > 1)) {
            report.push(`[top] preset marks are ${placed.join(' / ')} off the rail's scale`);
          }
        }
      }
    }

    expect(report, report.join('\n')).toEqual([]);
  });
}

test('a preset is reachable and settable from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('/icon-core/');

  const rail = page.locator(`${CARD} input[type="range"]`);
  const circle = page.locator(`${CARD} button[aria-label="Raio 256 px"]`);

  expect(await rail.getAttribute('aria-valuetext')).toBe('130 px');

  // The rail is one stop; after it come the four marks in scale order, one stop each. Walking the
  // real Tab order is the part jsdom cannot prove: it has no tab navigation at all.
  await rail.focus();
  const focused: string[] = [];
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    focused.push((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ?? '');
  }
  expect(focused).toEqual(['Raio 0 px', 'Raio 24 px', 'Raio 115 px', 'Raio 256 px']);

  await page.keyboard.press('Enter');

  expect(await rail.getAttribute('aria-valuetext')).toBe('256 px');
  expect(await circle.getAttribute('aria-pressed')).toBe('true');
});

