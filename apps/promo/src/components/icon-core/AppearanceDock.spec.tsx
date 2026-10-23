// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { click, mount, press } from '../../ui/testing/mount';
import { AppearanceDock, RadiusControl } from './controls';
import { StudioProvider } from './studio-context';

/**
 * The plate under a dock glyph is a **thumb**, and a thumb carries its own radius. The landing
 * mockup says so where it draws its smallest previews: every 22 px layer thumb is
 * `radii={20}` (`mockup-lovable-shader/main/src/components/icon-core/EditorShowcase.tsx`), a
 * fixed fifth of its box — never the 130/512 = 25.39 % of the 512 px icon. Reusing the icon's
 * radius here is what put a 9.65 px corner on the dock's 38 px plate, 23 % of the 42 px tile the
 * hero leaves it in at 360 px: 2 px from the tile's own 16 px corner reads as one blob.
 *
 * The expectations below are the plate's own path in the 512 viewBox, written as literals: 12 % of
 * 512 is 61.44, which the path formatter writes `61.4`. A test that recomputed that from
 * `THUMB_RADIUS` would agree with the code by construction.
 */

/** Top-left corner of each tile's plate, as the path draws it: `M<radius> 0`. */
const plateCorners = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGElement>('[role="radio"] svg clipPath path')).map(
    (path) => path.getAttribute('d')?.split(' ')[0] ?? ''
  );

const preset = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Raio "]')).find(
    (button) => button.getAttribute('aria-label') === label
  );

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

describe('appearance dock plates', () => {
  it('draws every tile at the thumb radius, not at the icon radius', async () => {
    const ui = mount();
    await ui.render(createElement(StudioProvider, null, createElement(AppearanceDock)));

    // Four tiles, one plate each: 12 % of 512 = 61.44, written `61.4`, where the icon's 130/512
    // would draw 130.0.
    expect(plateCorners(ui.container)).toEqual(['M61.4', 'M61.4', 'M61.4', 'M61.4']);
  });

  it('keeps the thumb radius when the frame radius changes', async () => {
    const ui = mount();
    await ui.render(
      createElement(StudioProvider, null, createElement(RadiusControl), createElement(AppearanceDock))
    );

    await click(preset(ui.container, 'Raio 256 px') as HTMLButtonElement);

    // The circle preset writes 50 % into the frame; the thumbs stay thumbs.
    expect(plateCorners(ui.container)).toEqual(['M61.4', 'M61.4', 'M61.4', 'M61.4']);
  });
});

/**
 * The tile's chip — the frame behind the glyph and the label — is a share of its own width, because
 * a fixed class cannot be: `rounded-xl` is 16 px in this theme, which is 38 % of the compact dock's
 * 42 px tile and 22.8 % of the mockup's 70.25 px one. The mockup's share is 12 / 70.25 = 17.1 %,
 * and a tile is `(100cqw - 3 × 4px) / 4` wide inside the dock's container, so the expression is
 * `4.2705cqw - 0.5125px` — written below as a literal, not recomputed from the source constant.
 * The order is jsdom's: it serialises the `calc` with the length first.
 */
const TILE_RADIUS = 'calc(-0.5125px + 4.2705cqw)';

describe('appearance dock tiles', () => {
  it('takes the tile frame radius from the dock width, not from a fixed class', async () => {
    const ui = mount();
    await ui.render(createElement(StudioProvider, null, createElement(AppearanceDock)));

    const tiles = Array.from(ui.container.querySelectorAll<HTMLElement>('[role="radio"]'));

    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => tile.style.borderRadius)).toEqual(Array(4).fill(TILE_RADIUS));
  });
});

/**
 * The dock is a radiogroup with a roving tabindex: focus moves and the selection follows it, which
 * is why the arrows change `aria-checked` as they walk. `Home` and `End` are that same walk at its
 * ends — the landing's own menu has handled them for longer (`EditorShowcase`, "Opções de
 * exibição"), and the dock handled only the four arrows.
 *
 * The labels are literals because the order is the contract: Default, Light, Dark, Mono.
 */
describe('appearance dock keyboard ends', () => {
  it('jumps to the last tile with End, and back to the first with Home', async () => {
    const ui = mount();
    await ui.render(createElement(StudioProvider, null, createElement(AppearanceDock)));

    const tiles = Array.from(ui.container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

    expect(tiles.map((tile) => tile.textContent)).toEqual(['Default', 'Light', 'Dark', 'Mono']);

    await press(tiles[0] as HTMLButtonElement, 'End');

    expect(document.activeElement).toBe(tiles[3]);
    expect(tiles[3]?.getAttribute('aria-checked')).toBe('true');

    await press(tiles[3] as HTMLButtonElement, 'Home');

    expect(document.activeElement).toBe(tiles[0]);
    expect(tiles[0]?.getAttribute('aria-checked')).toBe('true');
  });
});
