import type { Fill, IconLayer, IconVariant, ShapeKind } from '@iconcore/shared';
import type { RenderBackend, ResolvedLayer } from './types';

const resolveLayerForVariant = (
  layer: IconLayer,
  variant: IconVariant
): ResolvedLayer => {
  const overrides = layer.variantOverrides?.[variant];
  return {
    ...layer,
    resolvedFill: overrides?.fill ?? layer.fill,
    resolvedStroke: overrides?.stroke ?? layer.stroke,
    resolvedOpacity: overrides?.opacity ?? layer.opacity,
    resolvedVisible: overrides?.visible ?? layer.visible,
    resolvedBlendMode: overrides?.blendMode ?? layer.blendMode ?? 'normal'
  };
};

export const composeLayers = async (
  layers: IconLayer[],
  canvasSize: number,
  background: Fill,
  variant: IconVariant,
  safeArea: { inset: number; shape: ShapeKind } | undefined,
  backend: RenderBackend
): Promise<Blob> => {
  const ctx = backend.createCanvas(canvasSize, canvasSize);

  backend.applyFill(ctx, background, 0, 0, canvasSize, canvasSize);

  const visible = layers
    .filter(l => l.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  const resolved: ResolvedLayer[] = visible.map(l => resolveLayerForVariant(l, variant));

  for (const layer of resolved) {
    if (!layer.resolvedVisible) continue;

    const ctxAny = ctx.native as CanvasRenderingContext2D;
    ctxAny.save();

    if (layer.resolvedBlendMode && layer.resolvedBlendMode !== 'normal') {
      backend.applyBlendMode(ctx, layer.resolvedBlendMode);
    }

    if (layer.resolvedOpacity < 1) {
      backend.applyOpacity(ctx, layer.resolvedOpacity);
    }

    if (layer.transform) {
      backend.applyTransform(ctx, layer.transform);
    }

    if (layer.source.shape) {
      const shape = layer.source.shape;
      if (layer.resolvedFill) {
        backend.applyFill(ctx, layer.resolvedFill, 0, 0, shape.width, shape.height);
      }
    }

    if (layer.source.type === 'inline' && layer.source.data) {
      try {
        const mimeType = layer.source.mimeType ?? 'image/png';
        const binary = atob(layer.source.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        const img = await backend.loadImage(blob);
        const scale = layer.transform?.scale ?? 1;
        backend.drawImage(ctx, img, 0, 0, img.width * scale, img.height * scale);
      } catch {
        // Skip layers that fail to load
      }
    }

    if (layer.source.type === 'reference' && layer.source.path) {
      try {
        const img = await backend.loadImage(layer.source.path);
        const scale = layer.transform?.scale ?? 1;
        backend.drawImage(ctx, img, 0, 0, img.width * scale, img.height * scale);
      } catch {
        // Skip layers that fail to load
      }
    }

    ctxAny.restore();
  }

  if (safeArea) {
    backend.applyMask(ctx, safeArea.shape, canvasSize, safeArea.inset * canvasSize);
  }

  return backend.toBlob(ctx, 'image/png');
};