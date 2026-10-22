// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { click, mount } from '../../ui/testing/mount';
import { RadiusControl } from './controls';
import { StudioProvider } from './studio-context';

/**
 * The radius control is where a preset becomes a shape: the rail carries the value, and the presets
 * are shortcuts to it. This is the seam the owner hit — four presets drawn as four glyphs, three of
 * which were the same picture — so what is asserted is what a visitor sees and does: two anchor
 * shapes at the ends of the scale, one clickable tick per preset on the rail, where each tick sits,
 * and what activating it writes into the studio.
 *
 * Expected numbers are literals read off the scale, never recomputed from the presets: the radius is
 * a percentage of a 512 px canvas, so the 24 px preset is 4.6875 % of the value and therefore
 * 9.375 % along the rail, the squircle is 22.5 % (45 % along it), and the circle is 50 % / 256 px.
 * A test that derived those from `RADIUS_PRESETS` would agree with the code by construction.
 */

beforeEach(() => {
  window.localStorage.clear();
  // jsdom does not implement matchMedia; the provider reads it for theme and reduced motion.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
  });
});

function renderControl() {
  const ui = mount();

  return { ui, render: ui.render(createElement(StudioProvider, null, createElement(RadiusControl))) };
}

/** The four presets by the radius they set — the same unit the slider announces. */
const PRESET_LABELS = ['Raio 0 px', 'Raio 24 px', 'Raio 115 px', 'Raio 256 px'];

const marks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Raio "]'));

const mark = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) as HTMLButtonElement;

const rail = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="range"]') as HTMLInputElement;

const pressed = (container: HTMLElement) =>
  marks(container).map((element) => element.getAttribute('aria-pressed'));

describe('the marks on the scale', () => {
  it('keeps a glyph only at the two ends of the scale', async () => {
    const { ui, render } = renderControl();
    await render;

    // The complaint was a row of four squares: the shapes are now the two ends, and they are scenery.
    const anchors = ui.container.querySelectorAll('svg');
    expect(anchors).toHaveLength(2);
    expect(anchors[0]?.parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(anchors[1]?.parentElement?.getAttribute('aria-hidden')).toBe('true');

    // Document order is the tab order, and it follows the scale: 0, 24 px, squircle, circle.
    expect(marks(ui.container).map((element) => element.getAttribute('aria-label'))).toEqual(PRESET_LABELS);
    // Every preset is a control, so none of the four is only a picture.
    expect(marks(ui.container).map((element) => element.querySelector('svg'))).toEqual([null, null, null, null]);
  });

  it('places each tick where the thumb sits when that preset is selected', async () => {
    const { ui, render } = renderControl();
    await render;

    // A rail's thumb travels half a thumb inside its box, so the marks are placed in a layer inset by
    // that half: 0 % is the square end, 100 % the circle end.
    expect(mark(ui.container, 'Raio 0 px').style.left).toBe('0%');
    expect(mark(ui.container, 'Raio 24 px').style.left).toBe('9.375%');
    expect(mark(ui.container, 'Raio 115 px').style.left).toBe('45%');
    expect(mark(ui.container, 'Raio 256 px').style.left).toBe('100%');
  });

  it('names the readout and the presets in the unit the slider announces', async () => {
    const { ui, render } = renderControl();
    await render;

    // The page opens at a 130 px radius, which is between presets: nothing is selected.
    expect(pressed(ui.container)).toEqual(['false', 'false', 'false', 'false']);
    expect(ui.container.querySelector('output')?.textContent).toBe('130 px');
    expect(ui.container.querySelector('label')?.getAttribute('for')).toBe(rail(ui.container).id);
  });
});

describe('activating a preset', () => {
  it('snaps the radius to an end of the scale', async () => {
    const { ui, render } = renderControl();
    await render;

    await click(mark(ui.container, 'Raio 256 px'));
    expect(rail(ui.container).value).toBe('50');
    expect(rail(ui.container).getAttribute('aria-valuetext')).toBe('256 px');

    await click(mark(ui.container, 'Raio 0 px'));
    expect(rail(ui.container).value).toBe('0');
    expect(rail(ui.container).getAttribute('aria-valuetext')).toBe('0 px');
  });

  it('snaps the radius to a tick on the rail', async () => {
    const { ui, render } = renderControl();
    await render;

    await click(mark(ui.container, 'Raio 24 px'));
    expect(rail(ui.container).value).toBe('4.6875');
    expect(rail(ui.container).getAttribute('aria-valuetext')).toBe('24 px');
    expect(ui.container.querySelector('output')?.textContent).toBe('24 px');

    await click(mark(ui.container, 'Raio 115 px'));
    expect(rail(ui.container).value).toBe('22.5');
    expect(rail(ui.container).getAttribute('aria-valuetext')).toBe('115 px');
  });

  it('marks the selected preset and only that one', async () => {
    const { ui, render } = renderControl();
    await render;

    await click(mark(ui.container, 'Raio 115 px'));
    expect(pressed(ui.container)).toEqual(['false', 'false', 'true', 'false']);

    await click(mark(ui.container, 'Raio 0 px'));
    expect(pressed(ui.container)).toEqual(['true', 'false', 'false', 'false']);
  });
});

describe('reachable without a mouse', () => {
  it('makes every preset a native button in scale order, so Tab reaches it and Enter activates it', async () => {
    const { ui, render } = renderControl();
    await render;

    const ticks = marks(ui.container);
    expect(ticks.map((element) => element.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
    // `type=button`: no form submit, and the browser's own Enter/Space activation applies.
    expect(ticks.map((element) => element.type)).toEqual(['button', 'button', 'button', 'button']);
    // No roving tabindex: all four are stops, so the rail and the presets are walked in scale order.
    expect(ticks.map((element) => element.tabIndex)).toEqual([0, 0, 0, 0]);

    ticks[1]?.focus();
    expect(document.activeElement).toBe(ticks[1]);

    // jsdom does not synthesise a button's Enter activation — that is browser UI, not DOM — so the
    // press itself is asserted in a real browser by `tests/e2e/promo-dock.spec.ts`; what this harness
    // can prove is that the stop exists and that activating it writes the preset.
    await click(ticks[1] as HTMLButtonElement);
    expect(rail(ui.container).value).toBe('4.6875');
  });
});
