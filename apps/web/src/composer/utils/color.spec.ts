import { describe, expect, it } from 'vitest';
import { darken, hexToRgb, lighten, mapFillColors, rgbToHex, toGray } from './color';

describe('color helpers', () => {
  it('parses and serializes hex colors', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('336699')).toEqual({ r: 51, g: 102, b: 153 });
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000');
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });

  it('lightens toward white and darkens toward black', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(darken('#ffffff', 0.5)).toBe('#808080');
    expect(lighten('#808080', 0)).toBe('#808080');
    // non-hex passes through untouched
    expect(lighten('rgb(0,0,0)', 0.5)).toBe('rgb(0,0,0)');
  });

  it('converts to a single perceptual gray', () => {
    const gray = toGray('#ff0000');
    const rgb = hexToRgb(gray)!;
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });

  it('maps colors across solid fills and gradient stops', () => {
    expect(mapFillColors({ kind: 'solid', color: '#000000' }, () => '#ffffff')).toEqual({ kind: 'solid', color: '#ffffff' });
    const gradient = mapFillColors(
      { kind: 'linear-gradient', stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#111111' }] },
      () => '#abcdef'
    );
    expect(gradient?.stops?.every((s) => s.color === '#abcdef')).toBe(true);
    expect(mapFillColors(undefined, () => '#fff')).toBeUndefined();
  });
});
