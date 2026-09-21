import { describe, expect, it } from 'vitest';
import { parseSvgIntrinsicSize } from './fileLayers';

/**
 * Regression coverage for F3 — an SVG must be measured by its own intrinsic
 * size. Before this, every SVG was assumed to be 512×512, so `layerBaseRect`
 * produced a square rectangle and the Canvas2D backend stretched (squished)
 * every non-square asset into it.
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
