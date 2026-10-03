import { describe, expect, it } from 'vitest';

import { composeLayers } from '../src/composeLayers';
import type { RenderBackend, RenderContext } from '../src/types';

/**
 * Does `composeLayers` actually clip?
 *
 * Measured, it did not: rendering the same project with `mask: 'rounded-rectangle'`
 * and with `mask: 'none'` produced byte-identical PNGs — zero transparent pixels
 * either way. The SVG path clipped correctly, so the export mirror added in #191
 * worked for the file format and not for the raster one.
 *
 * The trace below records whether `clip()` was ever called, which says *where* the
 * clip is lost without depending on a browser to rasterise.
 */
const recordingBackend = () => {
  const chamadas: string[] = [];

  const native = {
    save: () => chamadas.push('save'),
    restore: () => chamadas.push('restore'),
    beginPath: () => chamadas.push('beginPath'),
    closePath: () => chamadas.push('closePath'),
    clip: () => chamadas.push('clip'),
    rect: (...a: number[]) => chamadas.push(`rect:${a.join(',')}`),
    roundRect: (...a: number[]) => chamadas.push(`roundRect:${a.join(',')}`),
    arc: (...a: number[]) => chamadas.push(`arc:${a.join(',')}`),
    ellipse: (...a: number[]) => chamadas.push(`ellipse:${a.join(',')}`),
    moveTo: () => {},
    bezierCurveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    drawImage: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    clearRect: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createConicGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    filter: 'none',
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true
  };

  const ctx = { native } as unknown as RenderContext;

  const backend = {
    createCanvas: () => ctx,
    loadImage: async () => ({}) as never,
    drawImage: () => {},
    applyTransform: () => {},
    applyMask: () => {},
    applyFill: () => {},
    applyOpacity: () => {},
    applyBlendMode: () => {},
    toBlob: async () => new Blob(['x']),
    resize: async (b: Blob) => b,
    destroy: () => {}
  } as unknown as RenderBackend;

  return { backend, chamadas };
};

const layer = () => ({
  id: 'l1',
  name: 's',
  kind: 'shape' as const,
  visible: true,
  zIndex: 0,
  source: {
    type: 'reference' as const,
    path: '',
    shape: { kind: 'rectangle' as const, width: 224, height: 224, cornerRadius: 0 }
  },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid' as const, color: '#1565c0' }
});

const canvas = { width: 256, height: 256 };
const fundo = { kind: 'solid' as const, color: '#ffffff' };

describe('composeLayers clips when asked', () => {
  it('calls clip() for a rounded-rectangle mask', async () => {
    const { backend, chamadas } = recordingBackend();

    await composeLayers(
      [layer()] as never,
      canvas,
      fundo as never,
      'default' as never,
      undefined,
      backend,
      'rounded-rectangle',
      { size: 256, maskRadius: 48 }
    );

    expect(chamadas).toContain('clip');
  });

  it('does not clip to the canvas when no shape is given', async () => {
    // `clip()` also appears per layer — the fill is clipped to its own shape, and
    // that one is legitimate. What must not appear without a mask is a clip that
    // brackets the whole composition, which is identified by `roundRect`/`ellipse`
    // with the canvas dimensions, not by the bare call.
    const { backend, chamadas } = recordingBackend();

    await composeLayers(
      [layer()] as never,
      canvas,
      fundo as never,
      'default' as never,
      undefined,
      backend,
      undefined,
      { size: 256, maskRadius: 48 }
    );

    const clipDoCanvas = chamadas.find(
      (c) => c.startsWith('roundRect:0,0,256,256') || c.startsWith('ellipse:')
    );
    expect(clipDoCanvas).toBeUndefined();
  });

  it('clips the canvas to the declared radius', async () => {
    const { backend, chamadas } = recordingBackend();

    await composeLayers(
      [layer()] as never,
      canvas,
      fundo as never,
      'default' as never,
      undefined,
      backend,
      'rounded-rectangle',
      { size: 256, maskRadius: 48 }
    );

    // Full-canvas outline at the radius read from the project, which is the
    // whole point: the radius comes from the document, not from a shape default.
    expect(chamadas).toContain('roundRect:0,0,256,256,48');
  });

  it('clips a circle with an ellipse', async () => {
    const { backend, chamadas } = recordingBackend();

    await composeLayers(
      [layer()] as never,
      canvas,
      fundo as never,
      'default' as never,
      undefined,
      backend,
      'circle',
      { size: 256, maskRadius: 48 }
    );

    expect(chamadas.some((c) => c.startsWith('ellipse:'))).toBe(true);
    expect(chamadas).toContain('clip');
  });

  it('clips before painting, and the clip survives to the blob', async () => {
    // `clip()` in Canvas2D affects what is drawn *after* it, so an outline traced
    // at the end brackets nothing. This pins the order: outline, then paint, then
    // encode.
    //
    // The `restore()` calls belong to the per-layer save/restore pairs and are
    // legitimate — they do not undo a clip established on the context before the
    // loop, because that clip was set outside any of those pairs.
    const ordem: string[] = [];
    const native = {
      save: () => ordem.push('save'),
      restore: () => ordem.push('restore'),
      beginPath: () => {},
      closePath: () => {},
      clip: () => ordem.push('clip'),
      rect: () => {},
      roundRect: () => ordem.push('outline'),
      arc: () => {},
      ellipse: () => ordem.push('outline'),
      moveTo: () => {},
      bezierCurveTo: () => {},
      lineTo: () => {},
      fill: () => {},
      fillRect: () => ordem.push('pintou'),
      drawImage: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setTransform: () => {},
      clearRect: () => {},
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      filter: 'none',
      font: '10px sans-serif'
    };
    const ctx = { native } as unknown as RenderContext;

    const backend = {
      createCanvas: () => ctx,
      loadImage: async () => ({}) as never,
      drawImage: () => {},
      applyTransform: () => {},
      applyMask: () => {},
      applyFill: () => ordem.push('pintou'),
      applyOpacity: () => {},
      applyBlendMode: () => {},
      toBlob: async () => {
        ordem.push('toBlob');
        return new Blob(['x']);
      },
      resize: async (b: Blob) => b,
      destroy: () => {}
    } as unknown as RenderBackend;

    await composeLayers(
      [layer()] as never,
      canvas,
      fundo as never,
      'default' as never,
      undefined,
      backend,
      'rounded-rectangle',
      { size: 256, maskRadius: 48 }
    );

    const iOutline = ordem.indexOf('outline');
    const iPintou = ordem.indexOf('pintou');
    const iBlob = ordem.indexOf('toBlob');

    expect(iOutline, 'a outline foi traceada').toBeGreaterThanOrEqual(0);
    expect(iOutline, 'outline antes de pintar').toBeLessThan(iPintou);
    expect(iPintou, 'pintar antes de codificar').toBeLessThan(iBlob);
  });
});
