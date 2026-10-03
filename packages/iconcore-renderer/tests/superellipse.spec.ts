import { describe, expect, it } from 'vitest';

import {
  SUPERELLIPSE_N,
  superellipseOffsets,
  superellipsePathD,
  traceSuperellipse
} from '../src/geometry/superellipse';

/**
 * The recorded trace, plus the start point.
 *
 * A cubic Bézier segment carries six numbers: **two are the segment's start
 * point**, four are the control/end points. `bezierCurveTo` only takes the four,
 * because the start is wherever the path already is. Getting this distinction
 * wrong is what the first version of these tests did, and it hid a real bug in
 * the curve: the first segment's start was `width - ox` while the path began at
 * `ox`, so the outline had a discontinuity at the top edge.
 */
interface Trace {
  start: [number, number];
  /** `[c1x, c1y, c2x, c2y, endX, endY]` per segment. */
  segments: number[][];
}

const record = (x: number, y: number, w: number, h: number): Trace => {
  let start: [number, number] = [NaN, NaN];
  const segments: number[][] = [];

  const ctx = {
    moveTo: (px: number, py: number) => {
      start = [px, py];
    },
    bezierCurveTo: (...c: number[]) => {
      // The start of this segment is where the path currently is.
      segments.push([start[0], start[1], ...c]);
      start = [c[4], c[5]];
    }
  } as unknown as CanvasRenderingContext2D;

  traceSuperellipse(ctx, x, y, w, h);
  return { start, segments };
};

const parseD = (d: string): Trace => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let start: [number, number] = [nums[0], nums[1]];
  const segments: number[][] = [];

  let i = 2;
  while (i + 5 < nums.length) {
    segments.push([start[0], start[1], nums[i], nums[i + 1], nums[i + 2], nums[i + 3], nums[i + 4], nums[i + 5]]);
    start = [nums[i + 4], nums[i + 5]];
    i += 6;
  }
  return { start, segments };
};

describe('superellipse is defined once', () => {
  it('scales the offset per axis, not from one extent', () => {
    // The mask used to compute one offset from `width` and apply it to both
    // axes, which stretched a non-square mask.
    const { ox, oy } = superellipseOffsets(220, 120);

    expect(ox).not.toBe(oy);
    expect(ox).toBeCloseTo((220 * (1 - SUPERELLIPSE_N)) / 2, 6);
    expect(oy).toBeCloseTo((120 * (1 - SUPERELLIPSE_N)) / 2, 6);
  });

  it('stays square when the box is', () => {
    const { ox, oy } = superellipseOffsets(200, 200);

    expect(ox).toBe(oy);
  });
});

describe('the outline is continuous', () => {
  it('starts each segment where the previous one ended', () => {
    // The bug this catches: the path begins at `ox`, but the first segment's
    // implied start was `width - ox`. Both x and y disagreed, so the top edge
    // had a jump. Nothing noticed, because the outline still closed.
    for (const [w, h] of [
      [200, 200],
      [220, 120],
      [64, 256]
    ]) {
      const { segments } = record(0, 0, w, h);

      for (let i = 1; i < segments.length; i += 1) {
        expect(segments[i][0], `segment ${i} start x, ${w}x${h}`).toBeCloseTo(segments[i - 1][6], 6);
        expect(segments[i][1], `segment ${i} start y, ${w}x${h}`).toBeCloseTo(segments[i - 1][7], 6);
      }
    }
  });

  it('closes: the last segment ends where the path began', () => {
    const { start, segments } = record(0, 0, 200, 200);
    const ultimo = segments[segments.length - 1];

    expect(ultimo[6]).toBeCloseTo(start[0], 6);
    expect(ultimo[7]).toBeCloseTo(start[1], 6);
  });

  it('visits the four corners in order', () => {
    const { segments } = record(0, 0, 200, 200);

    // Segment ends: right edge, bottom edge, left edge, back to the top.
    expect(segments.map((s) => [s[6], s[7]])).toEqual([
      [200, 160],
      [40, 200],
      [0, 40],
      [40, 0]
    ]);
  });

  it('has four segments', () => {
    expect(record(0, 0, 200, 200).segments).toHaveLength(4);
  });
});

describe('canvas and SVG describe the same curve', () => {
  it('emits identical points for a square box', () => {
    const c = record(0, 0, 200, 200);
    const s = parseD(superellipsePathD(200, 200));

    expect(s.start).toEqual(c.start);
    expect(s.segments).toEqual(c.segments);
  });

  it('emits identical points for a non-square box', () => {
    // Two separate bugs lived here: the SVG reused a square path, and the mask
    // reused the width offset for the height.
    const c = record(0, 0, 220, 120);
    const s = parseD(superellipsePathD(220, 120));

    expect(s.start).toEqual(c.start);
    expect(s.segments).toEqual(c.segments);
  });

  it('honours the placement offset the caller passes', () => {
    const c = record(28, 68, 200, 200);
    const s = parseD(superellipsePathD(200, 200));

    expect(c.start[0] - s.start[0]).toBeCloseTo(28, 6);
    expect(c.start[1] - s.start[1]).toBeCloseTo(68, 6);
  });
});
