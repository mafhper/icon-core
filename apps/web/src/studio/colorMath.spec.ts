import { describe, expect, it } from 'vitest';
import {
  formatColor,
  hexToHsv,
  hexToRgb,
  hslToRgb,
  hsvToHex,
  hsvToRgb,
  normalizeHex,
  parseColorField,
  rgbToHex,
  rgbToHsl,
  rgbToHsv
} from './colorMath';

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

describe('rgb dialect', () => {
  it('converts both ways on known values', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe('#ff8800');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('hsv and rgb agree on the primaries', () => {
    expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, v: 1 });
  });
});

describe('hsl dialect', () => {
  it('converts both ways on known values', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 });
    expect(hslToRgb({ h: 120, s: 100, l: 25 })).toEqual({ r: 0, g: 128, b: 0 });
    expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('field format and parse', () => {
  it('prints each format in its own shape', () => {
    expect(formatColor('#ff0000', 'hex')).toBe('#ff0000');
    expect(formatColor('#ff0000', 'rgb')).toBe('255, 0, 0');
    expect(formatColor('#ff0000', 'hsl')).toBe('0, 100%, 50%');
    expect(formatColor('#ff0000', 'hsb')).toBe('0, 100%, 100%');
    expect(formatColor('#808080', 'hsl')).toBe('0, 0%, 50%');
  });

  it('parses what it prints, and refuses the rest', () => {
    expect(parseColorField('255, 0, 0', 'rgb')).toBe('#ff0000');
    expect(parseColorField('0, 100%, 50%', 'hsl')).toBe('#ff0000');
    expect(parseColorField('120, 100%, 25%', 'hsb')).toBe('#004000');
    expect(parseColorField('#abc', 'hex')).toBe('#aabbcc');
    expect(parseColorField('1, 2', 'rgb')).toBeNull();
    expect(parseColorField('red', 'hsl')).toBeNull();
    expect(parseColorField('zz', 'hex')).toBeNull();
  });

  it('clamps out-of-range channels instead of refusing', () => {
    expect(parseColorField('999, 0, 0', 'rgb')).toBe('#ff0000');
  });
});
