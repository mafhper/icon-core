import { describe, expect, it } from 'vitest';
import { computeSnap } from './snapping';

const box = { x: 0, y: 0, width: 200, height: 200 };

describe('computeSnap', () => {
  it('snaps the center to the canvas center when close', () => {
    const r = computeSnap({ ...box, x: 4, y: -3 }, [], 512, 0, 6);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.guides).toContainEqual({ axis: 'x', pos: 256 });
    expect(r.guides).toContainEqual({ axis: 'y', pos: 256 });
  });

  it('does not snap when outside the threshold', () => {
    const r = computeSnap({ ...box, x: 40, y: 40 }, [], 512, 0, 6);
    expect(r.x).toBe(40);
    expect(r.y).toBe(40);
    expect(r.guides).toHaveLength(0);
  });

  it('snaps the near edge to the safe-area inset', () => {
    // canvas 512, safe inset 40 → left safe line at x=40.
    // box width 200, half canvas 256, near-edge offset = 256-100 = 156.
    // value that puts near edge at 40 → 40 - 156 = -116.
    const r = computeSnap({ ...box, x: -114 }, [], 512, 40, 6);
    expect(r.x).toBe(-116);
    expect(r.guides).toContainEqual({ axis: 'x', pos: 40 });
  });

  it('snaps to another layer center', () => {
    const r = computeSnap({ ...box, x: 58 }, [{ x: 60, y: 0, width: 100, height: 100 }], 512, 0, 6);
    expect(r.x).toBe(60);
    expect(r.guides).toContainEqual({ axis: 'x', pos: 316 }); // 256 + 60
  });
});
