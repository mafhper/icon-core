import { test, expect, type Page } from '@playwright/test';

/**
 * The appearance dock is the landing page's only "preview" control: four tiles with an icon
 * and a label, hosted by the hero panel and by the editor showcase.
 *
 * It was one flex row of four `flex-1` tiles; at 320px the dock is ~270px, so each tile got
 * ~64px and the label span got ~46px of content box. The span is a flex item with the
 * default `min-width: auto`, which for nowrap text means the text itself: "Monochrome"
 * measures ~67px and **refused to shrink**, so `truncate` never engaged and the label
 * painted over the tile padding and the neighbours ("DefaultLightDarkonochrome").
 *
 * The first fix switched on the **viewport** (`grid grid-cols-2 sm:flex`). That is the wrong
 * axis: at a 1258px window `sm:flex` reads "wide, one row", but the dock's own column in the
 * hero card is ~149px — the radius control takes 13rem of a `max-w-xl` card — so four tiles
 * of ~34px were laid out on one row with a ~16px content box for a ~67px word. Same defect,
 * same reading, reintroduced by a breakpoint that never measured the box it was styling.
 *
 * The contract is therefore the **container**: the widget measures the space it was given.
 * Thresholds come from the label, not from a preference: "Monochrome" at 11px is ~67.5px and
 * the tile adds `px-2` (16px) plus its border (2px), so an intact tile needs ~85.5px. Two of
 * them plus the 4px gap fit from ~180px. Both hosts cap the slot below the ~354px that four
 * tiles would need (293px in the hero, 320px by `max-w-xs` in the editor), so a single row is
 * not reachable on this page and the ladder stops at two columns.
 *
 * These assertions are made in the browser because the defect is layout: jsdom computes no
 * geometry, and reading class names proves nothing about a text that overflows.
 */

const DOCK = '[role="radiogroup"][aria-label="Aparência do ícone e do site"]';
const LABELS = ['Default', 'Light', 'Dark', 'Monochrome'];

/** Narrowest container that holds two intact tiles: 2 × 88px + the 4px gap. */
const TWO_COLUMNS = 180;

/** Rows the dock must paint for the width *it* was given, not for the window. */
function expectedRows(container: number) {
  return container >= TWO_COLUMNS ? 2 : LABELS.length;
}

type Tile = {
  name: string;
  width: number;
  content: number;
  labelWidth: number;
  overflow: number;
  labelLeft: number;
  labelRight: number;
  left: number;
  right: number;
  top: number;
};

type Measurement = {
  docks: Array<{
    instance: string;
    width: number;
    rows: number;
    right: number;
    tiles: Tile[];
  }>;
  overflowFromDock: string[];
};

async function measure(page: Page, width: number): Promise<Measurement> {
  await page.setViewportSize({ width, height: 1400 });
  await page.goto('/icon-core/');
  // The label width IS the measurement: with a fallback face the numbers move.
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate((selector) => {
    const docks = [...document.querySelectorAll(selector)].map((dock) => {
      const dockRect = dock.getBoundingClientRect();
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
          width: tileRect.width,
          content,
          labelWidth: label.width,
          overflow: Math.max(0, (label.width - content) / 2),
          labelLeft: label.left,
          labelRight: label.right,
          left: tileRect.left,
          right: tileRect.right,
          top: Math.round(tileRect.top)
        };
      });
      return {
        instance: dock.closest('section')?.id ?? 'unknown',
        width: dockRect.width,
        rows: new Set(tiles.map((tile) => tile.top)).size,
        right: dockRect.right,
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
function minLabelGap(tiles: Tile[]) {
  const rows = [...new Set(tiles.map((tile) => tile.top))];
  return Math.min(
    ...rows.map((top) => {
      const row = tiles.filter((tile) => tile.top === top);
      return Math.min(...row.slice(1).map((tile, index) => tile.left - row[index]!.right));
    })
  );
}

// 320 is the narrowest supported phone, 360 the common Android width, 640/768/1280 the old
// "one row from `sm`" widths — kept because that is exactly where the viewport axis was
// wrong — and 1024/1100/1258 the wide window whose *card* is narrow (73px, 149px and 293px
// of dock). The expectation is derived from the width the dock measured, so these numbers
// stay honest if a host card changes.
for (const width of [320, 360, 640, 768, 1024, 1100, 1258, 1280] as const) {
  test(`appearance dock lays out from its own container at ${width}px`, async ({ page }) => {
    const { docks, overflowFromDock } = await measure(page, width);

    // Two instances share the component: the hero panel and the editor showcase.
    expect(docks.map((dock) => dock.instance).sort(), 'the dock was not found in both hosts').toEqual([
      'interface',
      'top'
    ]);

    const report: string[] = [];
    for (const dock of docks) {
      expect(dock.tiles.map((tile) => tile.name), `[${dock.instance}] the four labels changed`).toEqual(LABELS);

      const rows = expectedRows(dock.width);
      if (dock.rows !== rows) {
        report.push(
          `[${dock.instance}] container ${dock.width.toFixed(1)}px needs ${rows} row(s), the dock painted ${dock.rows}`
        );
      }

      for (const tile of dock.tiles) {
        if (tile.overflow > 0.5) {
          report.push(
            `[${dock.instance}] "${tile.name}": label ${tile.labelWidth.toFixed(1)}px in ${tile.content.toFixed(1)}px ` +
              `of content box (${tile.overflow.toFixed(1)}px outside, each side)`
          );
        }
        if (tile.labelLeft < tile.left - 0.5 || tile.labelRight > tile.right + 0.5) {
          report.push(
            `[${dock.instance}] "${tile.name}" paints outside its tile: ` +
              `label ${tile.labelLeft.toFixed(1)}..${tile.labelRight.toFixed(1)}, ` +
              `tile ${tile.left.toFixed(1)}..${tile.right.toFixed(1)}`
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
