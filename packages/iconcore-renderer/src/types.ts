import type { CanvasMaskShape, Fill, IconLayer, ShapeKind, Stroke, BlendMode } from '@iconcore/shared';

export interface ImageHandle {
  width: number;
  height: number;
  native: unknown;
}

export interface RenderContext {
  width: number;
  height: number;
  native: unknown;
}

/** Final-encode options for a rendered icon (format + lossy quality). */
/**
 * Whether the composed image paints the project's canvas background.
 *
 * `canvas` (the default) keeps the long-standing behaviour: the background the
 * user sees in the editor is the background in the output. Every editor and
 * preview caller wants this — it is the same picture they are looking at.
 *
 * `transparent` omits the background paint and keeps the alpha channel. The
 * export path asks for it, because a canvas background seeded by the factory
 * (`projectFactory` fills `light`/`dark`/`mono` with opaque colours) is a
 * *design-time* choice, and a favicon that arrives with a white square the user
 * never asked for is wrong on a light tab and invisible on a dark one.
 */
export type RenderBackground = 'canvas' | 'transparent';

export type RenderOptions = {
  format?: 'png' | 'webp' | 'jpeg';
  /** 0..1, applied to lossy formats only. */
  quality?: number;
  /** Defaults to `canvas`; the export path passes `transparent`. */
  background?: RenderBackground;
  /**
   * `'none'` keeps the image full bleed — the default, and what every caller
   * that never asked produced before. Any other value clips the finished image
   * to that outline, which is how the export mirrors the canvas frame.
   */
  mask?: CanvasMaskShape | 'none';
}

export interface RenderBackend {
  loadImage(source: string | Blob): Promise<ImageHandle>;
  createCanvas(width: number, height: number): RenderContext;
  drawImage(ctx: RenderContext, img: ImageHandle, dx: number, dy: number, dw: number, dh: number): void;
  applyTransform(ctx: RenderContext, transform: { x: number; y: number; scale: number; rotation: number }): void;
  applyMask(ctx: RenderContext, shape: ShapeKind, size: number, radius?: number): void;
  applyFill(ctx: RenderContext, fill: Fill, x: number, y: number, width: number, height: number): void;
  applyOpacity(ctx: RenderContext, opacity: number): void;
  applyBlendMode(ctx: RenderContext, mode: BlendMode): void;
  toBlob(ctx: RenderContext, format: string, quality?: number): Promise<Blob>;
  resize(source: Blob, targetW: number, targetH: number, format?: string, quality?: number): Promise<Blob>;
  destroy(): void;
}

export interface ResolvedLayer extends Omit<IconLayer, 'variantOverrides'> {
  resolvedFill?: Fill;
  resolvedStroke?: Stroke;
  resolvedOpacity: number;
  resolvedVisible: boolean;
  resolvedBlendMode: BlendMode;
  resolvedSource: IconLayer['source'];
  resolvedTransform: IconLayer['transform'];
  resolvedText?: IconLayer['text'];
  resolvedEffects?: IconLayer['effects'];
  /**
   * `IC63/1b`. Variant-aware, because a recolor is exactly the kind of change a brand
   * variant wants: the same artwork in light and dark, with the paint swapped.
   *
   * Merged rather than replaced — a variant that overrides one color keeps the rest,
   * which is what "this variant changes the accent" should mean.
   */
  resolvedSvgPaintOverrides?: Record<string, string>;
}

export { composeLayers } from './composeLayers';
export { renderProject } from './renderProject';
export { renderToSvg, renderToSvgWithOptions } from './renderToSvg';
export type { RenderSvgOptions, RenderSvgResult } from './renderToSvg';
export { sanitizeSvg } from './sanitizeSvg';
export { createCanvasBackend } from './backends/canvas';
export { applyMask } from './masks/applyMask';
export { layerBaseRect, containSize } from './geometry';
export type { LayerRect } from './geometry';
