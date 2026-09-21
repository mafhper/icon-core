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
  it('keeps the ratio of a wide asset instead of flooring the short axis', () => {
    const size = fitAssetSize(48, 24, 512);
    expect(size).toEqual({ width: 37.44, height: 18.72 });
    expect(ratio(size.width, size.height)).toBeCloseTo(2, 5);
  });

  it('keeps the ratio of a tall asset', () => {
    const size = fitAssetSize(24, 48, 512);
    expect(size).toEqual({ width: 18.72, height: 37.44 });
    expect(ratio(size.width, size.height)).toBeCloseTo(0.5, 5);
  });

  it('keeps extreme ratios intact', () => {
    const size = fitAssetSize(400, 20, 512);
    expect(ratio(size.width, size.height)).toBeCloseTo(20, 5);
    expect(size.width).toBeLessThanOrEqual(512);
  });

  it('raises the scale, not an axis, to keep very small assets grabbable', () => {
    const size = fitAssetSize(10, 5, 512);
    expect(size).toEqual({ width: 32, height: 16 });
    expect(ratio(size.width, size.height)).toBeCloseTo(2, 5);
  });

  it('never exceeds the canvas on the long side', () => {
    for (const [w, h] of [[512, 512], [1024, 256], [300, 900]] as const) {
      const size = fitAssetSize(w, h, 512);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(512);
    }
  });
});

describe('createLayerFromAsset', () => {
  it('stores a proportionally-sized rectangle for the renderer', () => {
    const layer = createLayerFromAsset(asset(48, 24), 512, 0);
    expect(layer.kind).toBe('svg');
    expect(layer.source.shape).toEqual({ kind: 'rectangle', width: 37.44, height: 18.72 });
  });

  it('classifies rasters as image layers', () => {
    const layer = createLayerFromAsset(asset(256, 128, 'image/png'), 512, 3);
    expect(layer.kind).toBe('image');
    expect(layer.zIndex).toBe(3);
  });
});
