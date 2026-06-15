import type { IconLayer } from '@iconcore/shared';

export interface LayerRect {
  /** Center X on the canvas, in canvas px (before the layer transform offset). */
  cx: number;
  /** Center Y on the canvas, in canvas px (before the layer transform offset). */
  cy: number;
  /** Base width in canvas px, before `transform.scale`. */
  w: number;
  /** Base height in canvas px, before `transform.scale`. */
  h: number;
}

/** Contain `src` within `bound` preserving aspect ratio. */
export const containSize = (
  srcW: number,
  srcH: number,
  boundW: number,
  boundH: number
): { w: number; h: number } => {
  const scale = Math.min(boundW / srcW, boundH / srcH);
  return { w: srcW * scale, h: srcH * scale };
};

/**
 * The base pixel rectangle a layer occupies on the canvas BEFORE its transform
 * (scale / rotation / offset) is applied. Always centered on the canvas — the
 * layer transform's x/y then offsets it, and scale/rotation pivot on this center.
 *
 * This is the single source of truth shared by the Canvas2D renderer
 * (`composeLayers`) and the editor's interaction overlay (`PreviewCanvas`), so
 * the live preview and the exported asset agree pixel-for-pixel.
 *
 * Shape layers (and uploaded assets, which always carry a proportionally-sized
 * rectangle shape) use the shape dimensions. Shapeless image layers fall back to
 * a contain-fit of the natural source size, or the full canvas when unknown.
 */
export const layerBaseRect = (
  layer: Pick<IconLayer, 'source'>,
  canvasSize: number,
  natural?: { width: number; height: number }
): LayerRect => {
  const shape = layer.source.shape;
  if (shape) {
    return { cx: canvasSize / 2, cy: canvasSize / 2, w: shape.width, h: shape.height };
  }
  if (natural) {
    const fit = containSize(natural.width, natural.height, canvasSize, canvasSize);
    return { cx: canvasSize / 2, cy: canvasSize / 2, w: fit.w, h: fit.h };
  }
  return { cx: canvasSize / 2, cy: canvasSize / 2, w: canvasSize, h: canvasSize };
};
