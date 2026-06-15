import { describe, expect, it } from 'vitest';
import type { IconLayer } from '@iconcore/shared';
import { layerBaseRect, containSize } from '../src/geometry';

const sourceWithShape = (w: number, h: number): Pick<IconLayer, 'source'> => ({
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: w, height: h } }
});

const shapelessSource = (): Pick<IconLayer, 'source'> => ({
  source: { type: 'inline', mimeType: 'image/png', data: 'x' }
});

describe('containSize', () => {
  it('fits a landscape source inside a square bound preserving aspect', () => {
    expect(containSize(200, 100, 512, 512)).toEqual({ w: 512, h: 256 });
  });

  it('fits a portrait source inside a square bound preserving aspect', () => {
    expect(containSize(100, 200, 512, 512)).toEqual({ w: 256, h: 512 });
  });
});

describe('layerBaseRect', () => {
  it('uses the shape dimensions, centered on the canvas', () => {
    expect(layerBaseRect(sourceWithShape(220, 140), 512)).toEqual({ cx: 256, cy: 256, w: 220, h: 140 });
  });

  it('contains a shapeless image by its natural size when provided', () => {
    expect(layerBaseRect(shapelessSource(), 512, { width: 1000, height: 500 })).toEqual({
      cx: 256,
      cy: 256,
      w: 512,
      h: 256
    });
  });

  it('falls back to the full canvas for a shapeless image with unknown size', () => {
    expect(layerBaseRect(shapelessSource(), 512)).toEqual({ cx: 256, cy: 256, w: 512, h: 512 });
  });
});
