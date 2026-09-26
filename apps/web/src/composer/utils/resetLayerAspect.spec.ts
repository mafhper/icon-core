import { describe, expect, it } from 'vitest';
import type { IconLayer } from '@iconcore/shared';
import { resetLayerAspect } from './projectFactory';

/** Build an imported-style layer whose stored `data` is the asset's SVG payload. */
const svgLayer = (
  svg: string,
  width: number,
  height: number,
  kind: IconLayer['kind'] = 'svg'
): IconLayer => ({
  id: 'layer-1',
  name: 'logo',
  kind,
  visible: true,
  zIndex: 0,
  source: {
    type: 'inline',
    mimeType: kind === 'svg' ? 'image/svg+xml' : 'image/png',
    data: btoa(svg),
    shape: { kind: 'rectangle', width, height }
  },
  transform: { x: 12, y: 34, scale: 1.5, rotation: 45 },
  opacity: 1
});

/**
 * IC3 §4.2 (option C) — a squashed image layer can be straightened back to the
 * asset's intrinsic ratio, with no schema change: the backends stretch the
 * source into exactly `source.shape` (`layerBaseRect`), so the shape *is* the
 * layer's proportion.
 */
describe('resetLayerAspect', () => {
  it('straightens a layer squashed to a square', async () => {
    const result = await resetLayerAspect(svgLayer('<svg viewBox="0 0 48 24"></svg>', 128, 128));

    expect(result.status).toBe('reset');
    if (result.status !== 'reset') return;

    // Long side (128) is kept; the short side comes from the 2:1 ratio.
    expect(result.layer.source.shape?.width).toBe(128);
    expect(result.layer.source.shape?.height).toBe(64);
    expect(result.from).toEqual({ width: 128, height: 128 });
  });

  it('restores the exact intrinsic ratio of a 48×24 asset', async () => {
    const result = await resetLayerAspect(svgLayer('<svg width="48" height="24"></svg>', 96, 40));

    expect(result.status).toBe('reset');
    if (result.status !== 'reset') return;

    expect(result.layer.source.shape?.width).toBe(96);
    expect(result.layer.source.shape?.height).toBe(48);
  });

  it('derives the long axis from the orientation', async () => {
    // A tall asset whose long side is currently horizontal.
    const result = await resetLayerAspect(svgLayer('<svg viewBox="0 0 24 48"></svg>', 100, 40));

    expect(result.status).toBe('reset');
    if (result.status !== 'reset') return;

    expect(result.layer.source.shape?.width).toBe(50);
    expect(result.layer.source.shape?.height).toBe(100);
  });

  it('leaves transform untouched', async () => {
    const layer = svgLayer('<svg viewBox="0 0 48 24"></svg>', 128, 128);
    const result = await resetLayerAspect(layer);

    expect(result.status).toBe('reset');
    if (result.status !== 'reset') return;

    expect(result.layer.transform).toEqual({ x: 12, y: 34, scale: 1.5, rotation: 45 });
  });

  it('is a no-op when the layer is already at the intrinsic ratio', async () => {
    const result = await resetLayerAspect(svgLayer('<svg viewBox="0 0 48 24"></svg>', 96, 48));

    expect(result.status).toBe('unchanged');
  });

  it('ignores layers that are not an inline image', async () => {
    const shape: IconLayer = {
      id: 'layer-2',
      name: 'Background',
      kind: 'shape',
      visible: true,
      zIndex: 0,
      source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 64, height: 32 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1
    };

    expect((await resetLayerAspect(shape)).status).toBe('not-applicable');
  });

  it('reports unmeasurable when the SVG declares no intrinsic size', async () => {
    // No width/height/viewBox: there is no ratio to restore, and guessing a
    // square is exactly the defect §7.1 removed.
    const result = await resetLayerAspect(svgLayer('<svg width="100%" height="100%"></svg>', 128, 64));

    expect(result.status).toBe('unmeasurable');
  });

  it('preserves area within a rounding step on tiny layers', async () => {
    const result = await resetLayerAspect(svgLayer('<svg viewBox="0 0 10 5"></svg>', 4, 4));

    expect(result.status).toBe('reset');
    if (result.status !== 'reset') return;

    // Long side 4 → 4×2, never rounded down to zero.
    expect(result.layer.source.shape?.width).toBe(4);
    expect(result.layer.source.shape?.height).toBe(2);
  });
});
