import { test, expect, type Page } from '@playwright/test';

/**
 * The appearance dock is the landing page's only "preview" control: four tiles with an icon
 * and a label. It was one flex row of four `flex-1` tiles; at 320px the dock is ~270px, so
 * each tile got ~64px and the label span got ~46px of content box.
 *
 * The span is a flex item with the default `min-width: auto`, which for nowrap text means
 * the text itself: "Monochrome" measures ~67px and **refused to shrink**, so `truncate`
 * never engaged. The label painted over the tile padding and the neighbours — the dock read
 * "DefaultLightDarkonochrome". A `flex-wrap` change does nothing either: the tiles are
 * `flex: 1 1 0%`, so they shrink instead of wrapping.
 *
 * The fix is a two-column grid below `sm` and the original single row from `sm` up. These
 * assertions are made in the browser because the defect is layout: jsdom computes no
 * geometry, and reader of class names proves nothing about a text that overflows.
 */

const DOCK = '[role="radiogroup"][aria-label="Aparência do ícone e do site"]';
const LABELS = ['Default', 'Light', 'Dark', 'Monochrome'];

type Measurement = {
  docks: Array<{
    instance: string;
    rows: number;
    right: number;
    tiles: Array<{
      name: string;
      tileWidth: number;
      content: number;
      labelWidth: number;
      overflow: number;
      left: number;
      right: number;
      top: number;
    }>;
  }>;
  overflowFromDock: string[];
};

async function measure(page: Page, width: number): Promise<Measurement> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/icon-core/');
  // The label width IS the measurement: with a fallback face the numbers move.
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate((selector) => {
    const docks = [...document.querySelectorAll(selector)].map((dock) => {
      const tiles = [...dock.querySelectorAll('[role="radio"]')].map((tile) => {
        const tileRect = tile.getBoundingClientRect();
        const tileStyle = getComputedStyle(tile);
        const content =
          tileRect.width -
          (parseFloat(tileStyle.paddingLeft) || 0) -
          (parseFloat(tileStyle.paddingRight) || 0) -
          (parseFloat(tileStyle.borderLeftWidth) || 0) -
          (parseFloat(tileStyle.borderRightWidth) || 0);
        const label = [...tile.querySelectorAll('span')].at(-1)!.getBoundingClientRect();
        return {
          name: (tile.textContent ?? '').trim(),
          tileWidth: tileRect.width,
          content,
          labelWidth: label.width,
          overflow: Math.max(0, (label.width - content) / 2),
          left: label.left,
          right: label.right,
          top: Math.round(tileRect.top)
        };
      });
      return {
        instance: dock.closest('section')?.id ?? 'unknown',
        rows: new Set(tiles.map((tile) => tile.top)).size,
        right: dock.getBoundingClientRect().right,
        tiles
      };
    });

    // The page has its own pre-existing horizontal overflow in the top bar (native-tooltip
    // spans at `left-[104%]`). What this contract owns is that the dock contributes none:
    // nothing inside a dock may extend past the viewport.
    const overflowFromDock: string[] = [];
    for (const dock of document.querySelectorAll(selector)) {
      for (const element of [dock, ...dock.querySelectorAll('*')]) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.right > window.innerWidth + 1) {
          overflowFromDock.push(`${element.tagName.toLowerCase()} right=${Math.round(rect.right)}`);
        }
      }
    }

    return { docks, overflowFromDock };
  }, DOCK);
}

/** Distance between the text of two tiles on the same row; negative means overlap. */
function minLabelGap(tiles: Measurement['docks'][number]['tiles']) {
  const rows = [...new Set(tiles.map((tile) => tile.top))];
  return Math.min(
    ...rows.map((top) => {
      const row = tiles.filter((tile) => tile.top === top);
      return Math.min(...row.slice(1).map((tile, index) => tile.left - row[index]!.right));
    })
  );
}

// 320 is the narrowest supported phone; 360 is the common Android width; 640 is `sm`,
// where the dock is allowed to be one row again.
for (const width of [320, 360] as const) {
  test(`appearance dock labels fit their tile at ${width}px`, async ({ page }) => {
    const { docks, overflowFromDock } = await measure(page, width);

    // Two instances share the component: the hero panel and the editor showcase.
    expect(docks.map((dock) => dock.instance).sort(), 'the dock was not found in both hosts').toEqual([
      'interface',
      'top'
    ]);

    const report: string[] = [];
    for (const dock of docks) {
      expect(dock.tiles.map((tile) => tile.name), `[${dock.instance}] the four labels changed`).toEqual(LABELS);

      for (const tile of dock.tiles) {
        if (tile.overflow > 0.5) {
          report.push(
            `[${dock.instance}] "${tile.name}": label ${tile.labelWidth.toFixed(1)}px in ${tile.content.toFixed(1)}px ` +
              `of content box (${tile.overflow.toFixed(1)}px outside, each side)`
          );
        }
      }
      const gap = minLabelGap(dock.tiles);
      if (gap <= 0) report.push(`[${dock.instance}] labels on the same row overlap by ${(-gap).toFixed(1)}px`);
    }

    expect(report, report.join('\n')).toEqual([]);
    expect(overflowFromDock, `the dock pushes the page: ${overflowFromDock.join(', ')}`).toEqual([]);
  });
}

for (const width of [640, 768, 1280] as const) {
  test(`appearance dock keeps one row at ${width}px`, async ({ page }) => {
    const { docks, overflowFromDock } = await measure(page, width);

    expect(docks).toHaveLength(2);
    for (const dock of docks) {
      expect(dock.rows, `[${dock.instance}] the dock stacked ${dock.rows} rows at ${width}px`).toBe(1);
      const gap = minLabelGap(dock.tiles);
      expect(gap, `[${dock.instance}] labels on the single row overlap`).toBeGreaterThan(0);
      expect(dock.right, `[${dock.instance}] dock extends past the viewport`).toBeLessThanOrEqual(width + 1);
    }
    expect(overflowFromDock, `the dock pushes the page: ${overflowFromDock.join(', ')}`).toEqual([]);
  });
}
