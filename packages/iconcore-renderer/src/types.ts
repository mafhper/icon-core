import type { Fill, IconVariant, IconLayer, ShapeKind, Stroke, BlendMode } from '@iconcore/shared';

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
  resize(source: Blob, targetW: number, targetH: number): Promise<Blob>;
  destroy(): void;
}

export interface ResolvedLayer extends Omit<IconLayer, 'variantOverrides'> {
  resolvedFill?: Fill;
  resolvedStroke?: Stroke;
  resolvedOpacity: number;
  resolvedVisible: boolean;
  resolvedBlendMode: BlendMode;
}

export { composeLayers } from './composeLayers';
export { renderProject } from './renderProject';
export { renderToSvg } from './renderToSvg';
export { sanitizeSvg } from './sanitizeSvg';
export { createCanvasBackend } from './backends/canvas';
export { applyMask } from './masks/applyMask';