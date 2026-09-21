import { describe, expect, it } from 'vitest';
import { parseSvgIntrinsicSize, setSvgViewport } from '../src/svgSize';

/**
 * The importer and the SVG exporter share this parser: if they disagree on a
 * document's intrinsic size, the PNG and SVG exports of the same project place
 * an inline SVG differently (and a square guess squishes non-square assets).
 */
describe('parseSvgIntrinsicSize', () => {
  it('reads the viewBox when no width/height are declared', () => {
    expect(parseSvgIntrinsicSize('<svg viewBox="0 0 48 24"></svg>')).toEqual({ width: 48, height: 24 });
  });

  it('prefers declared width/height', () => {
    expect(parseSvgIntrinsicSize('<svg width="24" height="12" viewBox="0 0 1 1"></svg>')).toEqual({
      width: 24,
      height: 12
    });
  });

  it('derives the missing axis from the viewBox ratio', () => {
    expect(parseSvgIntrinsicSize('<svg width="48" viewBox="0 0 24 24"></svg>')).toEqual({ width: 48, height: 48 });
    expect(parseSvgIntrinsicSize('<svg height="12" viewBox="0 0 48 24"></svg>')).toEqual({ width: 24, height: 12 });
  });

  it('ignores nested elements claiming their own width/height', () => {
    const svg = '<svg viewBox="0 0 10 20"><rect width="99" height="99"/></svg>';
    expect(parseSvgIntrinsicSize(svg)).toEqual({ width: 10, height: 20 });
  });

  it('converts physical units to CSS px and accepts comma-separated viewBoxes', () => {
    expect(parseSvgIntrinsicSize('<svg width="24pt" height="12pt"></svg>')).toEqual({ width: 32, height: 16 });
    expect(parseSvgIntrinsicSize('<svg viewBox="0,0,20.5,10.25"></svg>')).toEqual({ width: 21, height: 10 });
  });

  it('returns null when there is no usable intrinsic size', () => {
    expect(parseSvgIntrinsicSize('<svg width="100%" height="100%"></svg>')).toBeNull();
    expect(parseSvgIntrinsicSize('<svg><g/></svg>')).toBeNull();
    expect(parseSvgIntrinsicSize('not an svg')).toBeNull();
    expect(parseSvgIntrinsicSize('<svg viewBox="0 0 0 0"></svg>')).toBeNull();
  });

  it('falls back to the viewBox when a declared axis is invalid', () => {
    expect(parseSvgIntrinsicSize('<svg width="0" height="0" viewBox="0 0 8 8"></svg>')).toEqual({ width: 8, height: 8 });
  });
});

describe('setSvgViewport', () => {
  it('pins width/height, zeroes the origin and keeps the viewBox', () => {
    const out = setSvgViewport('<svg width="10" height="5" viewBox="0 0 10 5"><path d="M0 0"/></svg>', 30, 15);

    expect(out).toContain('width="30"');
    expect(out).toContain('height="15"');
    expect(out).toContain('x="0" y="0"');
    expect(out).toContain('viewBox="0 0 10 5"');
    expect(out).not.toContain('width="10"');
    expect(out).not.toContain('height="5"');
    expect(out).toContain('<path d="M0 0"/>');
  });

  it('handles self-closing roots and documents without a root svg', () => {
    const out = setSvgViewport('<svg viewBox="0 0 2 1"/>', 8, 4);

    expect(out).toContain('x="0" y="0" width="8" height="4"');
    expect(out).toContain('viewBox="0 0 2 1"');
    expect(out.endsWith('/>')).toBe(false);
    expect(setSvgViewport('nope', 8, 4)).toBe('nope');
  });
});
