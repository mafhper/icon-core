import { describe, expect, it } from 'vitest';
import { createLayerFromAsset, fitAssetSize } from './projectFactory';
import type { FileLayerAsset } from './fileLayers';

const asset = (width: number, height: number, mimeType = 'image/svg+xml'): FileLayerAsset => ({
  name: 'logo',
  mimeType,
  data: '',
  width,
  height
});

const ratio = (width: number, height: number) => width / height;

/**
 * Regression coverage for F3 — the fit must never change the aspect ratio.
 * The old code floored each axis at 32px, so a 48×24 asset was imported as
 * 37×32 (ratio 1.16 instead of 2) and the renderer stretched it to match.
 */
describe('fitAssetSize', () => {
  it('lets a borderless asset fill the canvas on its long side', () => {
    // The regression this describes: a 256px icon dropped into a 512px canvas
    // used to land at 200px, because the 0.78 cap was applied to the *source*
    // instead of the canvas. That left a ~30% band of background on all four
    // sides of every exported icon.
    const size = fitAssetSize(256, 256, 512);
    expect(size).toEqual({ width: 512, height: 512 });
  });

  it('keeps the ratio of a wide asset instead of flooring the short axis', () => {
    const size = fitAssetSize(48, 24, 512);
    expect(size).toEqual({ width: 512, height: 256 });
    expect(ratio(size.width, size.height)).toBeCloseTo(2, 5);
  });

  it('keeps the ratio of a tall asset', () => {
    const size = fitAssetSize(24, 48, 512);
    expect(size).toEqual({ width: 256, height: 512 });
    expect(ratio(size.width, size.height)).toBeCloseTo(0.5, 5);
  });

  it('keeps extreme ratios intact', () => {
    const size = fitAssetSize(400, 20, 512);
    expect(ratio(size.width, size.height)).toBeCloseTo(20, 5);
    expect(size.width).toBeLessThanOrEqual(512);
  });

  it('raises the scale, not an axis, to keep very small assets grabbable', () => {
    const size = fitAssetSize(10, 5, 512);
    expect(ratio(size.width, size.height)).toBeCloseTo(2, 5);
    expect(size).toEqual({ width: 512, height: 256 });
  });

  it('never exceeds the canvas on the long side', () => {
    for (const [w, h] of [[512, 512], [1024, 256], [300, 900]] as const) {
      const size = fitAssetSize(w, h, 512);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(512);
    }
  });

  it('leaves the requested margin on every side when one is asked for', () => {
    // 22% margin reproduces the old visual, now as a deliberate choice.
    const size = fitAssetSize(256, 256, 512, 0.22);
    expect(size.width).toBeCloseTo(399.36, 1);
    expect(size.width).toBeCloseTo(size.height, 5);
  });

  it('clamps a nonsensical margin instead of producing a negative size', () => {
    for (const margin of [-1, 1, 5]) {
      const size = fitAssetSize(256, 256, 512, margin);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });
});

describe('createLayerFromAsset', () => {
  it('stores a proportionally-sized rectangle for the renderer', () => {
    const layer = createLayerFromAsset(asset(48, 24), 512, 0);
    expect(layer.kind).toBe('svg');
    expect(layer.source.shape).toEqual({ kind: 'rectangle', width: 512, height: 256 });
  });

  it('honours the project import margin', () => {
    const layer = createLayerFromAsset(asset(256, 256), 512, 0, 0.22);
    expect(layer.source.shape).toMatchObject({ width: 399.36, height: 399.36 });
  });

  it('classifies rasters as image layers', () => {
    const layer = createLayerFromAsset(asset(256, 128, 'image/png'), 512, 3);
    expect(layer.kind).toBe('image');
    expect(layer.zIndex).toBe(3);
  });
});
