// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { click, mount } from '../../ui/testing/mount';
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
