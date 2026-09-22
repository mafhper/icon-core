import { describe, expect, it } from 'vitest';
import { normalizeStops } from '../src/gradient';

describe('normalizeStops', () => {
  it('sorts by offset and defaults alpha to 1', () => {
    const out = normalizeStops([
      { offset: 1, color: '#ffffff' },
      { offset: 0, color: '#000000' }
    ]);
    expect(out.map((stop) => stop.offset)).toEqual([0, 1]);
    expect(out.every((stop) => stop.alpha === 1)).toBe(true);
  });

  it('preserves the stop id through sorting (the editor keys its rows by it)', () => {
    const out = normalizeStops([
      { offset: 1, color: '#ffffff', id: 'b' },
      { offset: 0, color: '#000000', id: 'a' }
    ]);
    expect(out.map((stop) => stop.id)).toEqual(['a', 'b']);
  });

  it('falls back to the default stops when fewer than two are given', () => {
    expect(normalizeStops([]).length).toBeGreaterThanOrEqual(2);
    expect(normalizeStops(undefined).length).toBeGreaterThanOrEqual(2);
  });
});
