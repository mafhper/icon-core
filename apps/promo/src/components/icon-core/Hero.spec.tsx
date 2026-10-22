// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { click, mount } from '../../ui/testing/mount';
import { Hero } from './Hero';
import { StudioProvider } from './studio-context';

/**
 * The hero's backdrop is the page shader. jsdom has no WebGL, which is the fallback path: the
 * backdrop is then the preset painted as a CSS gradient. That makes the whole chain observable
 * without a GPU -- dock click, studio state, preset for the appearance, backdrop paint -- and it
 * is the chain that used to end in a fixed backdrop.
 */

const originalGetContext = HTMLCanvasElement.prototype.getContext;

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
  // No WebGL in this environment: every ShaderCanvas takes the fallback instead of a context.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

const radio = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
    (element) => element.textContent?.trim() === label
  );

/** The page backdrop is the only direct child of the hero section that paints a gradient. */
const backdropPaint = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('#top > div[aria-hidden]')?.style.background ?? '';

describe('hero backdrop follows the dock', () => {
  it('repaints the shader preset when the appearance changes', async () => {
    const ui = mount();
    await ui.render(createElement(StudioProvider, null, createElement(Hero)));

    // "default" on a light page: the steel preset, whose chroma anchor is #8fe3f2.
    expect(backdropPaint(ui.container)).toContain('rgb(143, 227, 242)');

    await click(radio(ui.container, 'Dark') as HTMLButtonElement);
    // #03465a: the deep teal that only the dark appearance carries.
    expect(backdropPaint(ui.container)).toContain('rgb(3, 70, 90)');

    await click(radio(ui.container, 'Mono') as HTMLButtonElement);
    // Three greys and no chroma at all.
    expect(backdropPaint(ui.container)).toContain('rgb(194, 194, 194)');
    expect(backdropPaint(ui.container)).not.toContain('rgb(3, 70, 90)');
  });
});
