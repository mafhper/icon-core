import { describe, expect, it } from 'vitest';

import { APPEARANCES, pagePresetFor, type ShaderPreset } from '../../lib/appearance';
import { advanceFieldTime, frameSignature } from './ShaderCanvas';

const WIDTH = 640;
const HEIGHT = 360;
const POINTER = { x: 0.5, y: 0.55 };

const preset = (over: Partial<ShaderPreset> = {}): ShaderPreset => ({
  base: [0.2, 0.4, 0.6],
  c1: [0.3, 0.5, 0.7],
  c2: [0.25, 0.45, 0.65],
  c3: [0.35, 0.55, 0.75],
  iri: 0.4,
  light: 0.6,
  grain: 0.011,
  scale: 1.3,
  sat: 0.8,
  vig: 0.5,
  flow: 1,
  warp: 1,
  detail: 0.3,
  ...over,
});

const signature = (
  p: ShaderPreset,
  width = WIDTH,
  height = HEIGHT,
  mouse = POINTER
): string => frameSignature(width, height, mouse, p);

// One channel at a time, listed explicitly rather than derived from the implementation's
// key lists: this is the contract of "every uniform the frame writes is in the signature".
const MOVES: Array<[channel: string, over: Partial<ShaderPreset>]> = [
  ['base.r', { base: [0.9, 0.4, 0.6] }],
  ['base.g', { base: [0.2, 0.9, 0.6] }],
  ['base.b', { base: [0.2, 0.4, 0.9] }],
  ['c1.r', { c1: [0.9, 0.5, 0.7] }],
  ['c1.g', { c1: [0.3, 0.9, 0.7] }],
  ['c1.b', { c1: [0.3, 0.5, 0.9] }],
  ['c2.r', { c2: [0.9, 0.45, 0.65] }],
  ['c2.g', { c2: [0.25, 0.9, 0.65] }],
  ['c2.b', { c2: [0.25, 0.45, 0.9] }],
  ['c3.r', { c3: [0.9, 0.55, 0.75] }],
  ['c3.g', { c3: [0.35, 0.9, 0.75] }],
  ['c3.b', { c3: [0.35, 0.55, 0.9] }],
  ['iri', { iri: 0.9 }],
  ['light', { light: 0.9 }],
  ['grain', { grain: 0.041 }],
  ['scale', { scale: 1.9 }],
  ['sat', { sat: 0.3 }],
  ['vig', { vig: 0.9 }],
  ['flow', { flow: 1.9 }],
  ['warp', { warp: 1.9 }],
  ['detail', { detail: 0.9 }],
];

describe('shader frame signature under reduced motion', () => {
  // The freeze works by skipping any frame whose signature matches the previous one, so a
  // signature that misses a channel lets a transition converge on a frame never drawn.
  it('changes when any single uniformized channel changes', () => {
    const original = signature(preset());
    const leaking = MOVES.filter(([, over]) => signature(preset(over)) === original).map(
      ([channel]) => channel
    );

    expect(leaking).toEqual([]);
  });

  it('changes with the drawing size, which feeds the resolution uniform', () => {
    expect(signature(preset(), WIDTH + 1)).not.toBe(signature(preset()));
    expect(signature(preset(), WIDTH, HEIGHT + 1)).not.toBe(signature(preset()));
  });

  it('changes with the pointer, which feeds the light position', () => {
    expect(signature(preset(), WIDTH, HEIGHT, { x: 0.6, y: POINTER.y })).not.toBe(
      signature(preset())
    );
    expect(signature(preset(), WIDTH, HEIGHT, { x: POINTER.x, y: 0.65 })).not.toBe(
      signature(preset())
    );
  });

  it('treats drift below the drawn precision as a repeat, so a settled field stops repainting', () => {
    expect(signature(preset({ light: 0.60002 }))).toBe(signature(preset()));
    expect(signature(preset({ light: 0.601 }))).not.toBe(signature(preset()));
  });

  it('keeps the same signature for the same state', () => {
    expect(signature(preset())).toBe(signature(preset()));
  });
});

describe('hero backdrop and the appearance', () => {
  it('draws a different frame for every page appearance', () => {
    const frames = APPEARANCES.map(({ id }) => signature(pagePresetFor(id, false)));

    expect(new Set(frames).size).toBe(APPEARANCES.length);
  });

  it('repaints when only the motion of a preset changes', () => {
    const base = pagePresetFor('mono', false);
    const faster = { ...base, flow: base.flow + 0.05 };

    expect(signature(faster)).not.toBe(signature(base));
  });
});

describe('the field clock', () => {
  it('advances at the appearance pace and never runs backwards when the pace drops', () => {
    // One second per step, so each expected time is the previous one plus the flow itself.
    const times: number[] = [];
    let time = 8;

    for (const flow of [1.55, 1, 0.55, 0.22]) {
      time = advanceFieldTime(time, 1, flow);
      times.push(time);
    }

    expect(times[0]).toBeCloseTo(9.55, 10);
    expect(times[1]).toBeCloseTo(10.55, 10);
    expect(times[2]).toBeCloseTo(11.1, 10);
    expect(times[3]).toBeCloseTo(11.32, 10);

    for (let index = 1; index < times.length; index += 1) {
      expect(times[index], `step ${index} went backwards`).toBeGreaterThan(times[index - 1]);
    }
  });

  it('stops the clock when the pace is zero', () => {
    expect(advanceFieldTime(8, 0.5, 0)).toBe(8);
  });
});
