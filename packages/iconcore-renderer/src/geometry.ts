import type { Dimensions, IconLayer } from '@iconcore/shared';

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
 *
 * `canvas` is the resolved pair. A square canvas resolves to exactly the scalar
 * behaviour this had before non-square existed, because `width === height`.
 */
export const layerBaseRect = (
  layer: Pick<IconLayer, 'source'>,
  canvas: Dimensions,
  natural?: { width: number; height: number }
): LayerRect => {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const shape = layer.source.shape;
  if (shape) {
    return { cx, cy, w: shape.width, h: shape.height };
  }
  if (natural) {
    const fit = containSize(natural.width, natural.height, canvas.width, canvas.height);
    return { cx, cy, w: fit.w, h: fit.h };
  }
  return { cx, cy, w: canvas.width, h: canvas.height };
};
