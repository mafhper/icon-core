import { describe, expect, it } from 'vitest';

import {
  APPEARANCES,
  PAGE_PRESETS,
  THUMB_RADIUS,
  TILE_PRESETS,
  pagePresetFor,
  resolveDarkTheme,
  type Appearance,
  type ShaderPreset,
} from './appearance';

describe('page theme resolution', () => {
  it('follows the system preference for the default appearance', () => {
    expect(resolveDarkTheme('default', true)).toBe(true);
    expect(resolveDarkTheme('default', false)).toBe(false);
  });

  it('keeps an explicit appearance, whatever the system preference says', () => {
    expect(resolveDarkTheme('dark', false)).toBe(true);
    expect(resolveDarkTheme('light', true)).toBe(false);
    expect(resolveDarkTheme('mono', true)).toBe(false);
  });
});

/**
 * How each appearance moves its backdrop. The numbers are the design decision written as
 * literals, not recomputed from the presets: a test that reads the expectation back out of the
 * code cannot disagree with the code. `flow` is the field's clock, `warp` how far the noise
 * folds over itself, `detail` the depth of the second sheet.
 */
const MOTION: Record<Appearance, [flow: number, warp: number, detail: number]> = {
  default: [1, 1, 0.35],
  light: [1.55, 0.85, 0.6],
  dark: [0.55, 1.4, 0.45],
  mono: [0.22, 0.55, 0.15],
};

const motionOf = (preset: ShaderPreset): number[] => [preset.flow, preset.warp, preset.detail];

describe('page shader follows the appearance', () => {
  it('gives every appearance a field of its own, not just a palette', () => {
    for (const { id } of APPEARANCES) {
      expect(motionOf(pagePresetFor(id, false)), id).toEqual(MOTION[id]);
    }
  });

  it('orders the movement: light runs, default drifts, dark slows down, mono is nearly still', () => {
    // APPEARANCES is default, light, dark, mono.
    const flow = APPEARANCES.map(({ id }) => pagePresetFor(id, false).flow);

    expect(flow[1]).toBeGreaterThan(flow[0]);
    expect(flow[0]).toBeGreaterThan(flow[2]);
    expect(flow[2]).toBeGreaterThan(flow[3]);
  });

  it('keeps every field moving, so no appearance paints a dead backdrop', () => {
    for (const { id } of APPEARANCES) {
      expect(pagePresetFor(id, false).flow, id).toBeGreaterThan(0);
    }
  });

  it('deepens the warp in dark and flattens it for mono', () => {
    expect(pagePresetFor('dark', false).warp).toBeGreaterThan(pagePresetFor('default', false).warp);
    expect(pagePresetFor('mono', false).warp).toBeLessThan(pagePresetFor('light', false).warp);
  });

  it('never collapses two appearances into the same preset', () => {
    const presets = APPEARANCES.map(({ id }) => JSON.stringify(pagePresetFor(id, false)));

    expect(new Set(presets).size).toBe(APPEARANCES.length);
  });

  it('takes the motion from the appearance and the palette from the page theme', () => {
    // "default" follows the OS, so one appearance carries two palettes and a single motion.
    expect(motionOf(PAGE_PRESETS.defaultLight)).toEqual(motionOf(PAGE_PRESETS.defaultDark));
    expect(PAGE_PRESETS.defaultLight.base).not.toEqual(PAGE_PRESETS.defaultDark.base);
  });

  it('keeps mono out of color entirely', () => {
    expect(pagePresetFor('mono', false).sat).toBe(0);
    for (const id of ['default', 'light', 'dark'] as const) {
      expect(pagePresetFor(id, false).sat, id).toBe(1);
    }
  });

  it('leaves the icon tile on the reference field, so the change stays in the page backdrop', () => {
    for (const { id } of APPEARANCES) {
      expect(motionOf(TILE_PRESETS[id]), id).toEqual([1, 1, 0]);
    }
  });
});

/**
 * A thumb is not a miniature of the file: the mockup draws its 22 px previews at `radii={20}`
 * instead of the canvas radius. The numbers are the design decision as literals — 20 % of 512 is a
 * 102.4 corner, and the three sizes the promo previews the icon at are 38, 34 and 22 px.
 */
describe('thumb radius', () => {
  it('keeps a fifth of the plate, whatever the icon radius is', () => {
    expect(THUMB_RADIUS).toBe(20);
    expect((THUMB_RADIUS / 100) * 512).toBeCloseTo(102.4);
  });

  it('puts 7.6 px of corner on the hero dock, 6.8 on the editor dock, 4.4 on a layer row', () => {
    expect((THUMB_RADIUS / 100) * 38).toBeCloseTo(7.6);
    expect((THUMB_RADIUS / 100) * 34).toBeCloseTo(6.8);
    expect((THUMB_RADIUS / 100) * 22).toBeCloseTo(4.4);
  });
});
