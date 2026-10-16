import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, normalizeHex } from './colorMath';

describe('normalizeHex', () => {
  it('accepts with or without the hash, in either case', () => {
    expect(normalizeHex('#A1b2C3')).toBe('#a1b2c3');
    expect(normalizeHex('a1b2c3')).toBe('#a1b2c3');
  });

  it('expands the three-digit form', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });

  it('rejects anything that is not a colour', () => {
    expect(normalizeHex('zz')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
  });
});

describe('hexToHsv', () => {
  it('maps the primaries to their hue angles', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
  });

  it('reports greys as zero saturation', () => {
    const grey = hexToHsv('#808080');
    expect(grey?.s).toBe(0);
    expect(grey?.v).toBeCloseTo(0.502, 2);
  });

  it('rejects non-colours', () => {
    expect(hexToHsv('nope')).toBeNull();
  });
});

describe('hsvToHex', () => {
  it('renders the primaries and the extremes', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000');
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#ffffff');
  });

  it('round-trips hexes through HSV', () => {
    for (const hex of ['#c9f98d', '#1e4b40', '#45d8ad', '#f1ffc0']) {
      const hsv = hexToHsv(hex);
      expect(hsv).not.toBeNull();
      expect(hsvToHex(hsv!)).toBe(hex);
    }
  });
});
