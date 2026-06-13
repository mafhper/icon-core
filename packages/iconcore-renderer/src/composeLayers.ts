import type { Fill, IconLayer, IconVariant, ShapeKind } from '@iconcore/shared';
import { imageFilterToCss } from '@iconcore/shared';
import type { RenderBackend, ResolvedLayer } from './types';

const resolveLayerForVariant = (
  layer: IconLayer,
  variant: IconVariant
): ResolvedLayer => {
  const overrides = layer.variantOverrides?.[variant];
  return {
    ...layer,
    ...overrides,
    resolvedFill: overrides?.fill ?? layer.fill,
    resolvedStroke: overrides?.stroke ?? layer.stroke,
    resolvedOpacity: overrides?.opacity ?? layer.opacity,
    resolvedVisible: overrides?.visible ?? layer.visible,
    resolvedBlendMode: overrides?.blendMode ?? layer.blendMode ?? 'normal',
    resolvedSource: overrides?.source ? { ...layer.source, ...overrides.source } : layer.source,
    resolvedTransform: overrides?.transform ? { ...layer.transform, ...overrides.transform } : layer.transform,
    resolvedText: overrides?.text ? { ...layer.text, ...overrides.text } as IconLayer['text'] : layer.text,
    resolvedEffects: overrides?.effects ?? layer.effects
  };
};

const getContainedRect = (
  sourceWidth: number,
  sourceHeight: number,
  canvasSize: number
): { x: number; y: number; width: number; height: number } => {
  const scale = Math.min(canvasSize / sourceWidth, canvasSize / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (canvasSize - width) / 2,
    y: (canvasSize - height) / 2,
    width,
    height
  };
};

const traceShapePath = (
  native: CanvasRenderingContext2D,
  shape: NonNullable<IconLayer['source']['shape']>,
  x: number,
  y: number
): void => {
  const { width, height } = shape;
  native.beginPath();

  if (shape.kind === 'circle') {
    native.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  } else if (shape.kind === 'rounded-rectangle') {
    native.roundRect(x, y, width, height, shape.cornerRadius ?? Math.min(width, height) * 0.18);
  } else if (shape.kind === 'squircle') {
    const offset = Math.min(width, height) * 0.22;
    native.moveTo(x + offset, y);
    native.bezierCurveTo(x + width - offset, y, x + width, y + offset, x + width, y + height / 2);
    native.bezierCurveTo(x + width, y + height - offset, x + width - offset, y + height, x + width / 2, y + height);
    native.bezierCurveTo(x + offset, y + height, x, y + height - offset, x, y + height / 2);
    native.bezierCurveTo(x, y + offset, x + offset, y, x + offset, y);
  } else if (shape.kind === 'triangle') {
    native.moveTo(x + width / 2, y);
    native.lineTo(x + width, y + height);
    native.lineTo(x, y + height);
  } else if (shape.kind === 'line') {
    native.roundRect(x, y, width, height, Math.min(width, height) / 2);
  } else if (shape.kind === 'star') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outer = Math.min(width, height) / 2;
    const inner = outer * (shape.innerRatio ?? 0.5);
    const count = shape.pointCount ?? 5;
    for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / count) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) native.moveTo(px, py);
      else native.lineTo(px, py);
    }
  } else if (shape.kind === 'polygon' && shape.points?.length) {
    native.moveTo(x + shape.points[0].x, y + shape.points[0].y);
    for (const point of shape.points.slice(1)) {
      native.lineTo(x + point.x, y + point.y);
    }
  } else {
    native.rect(x, y, width, height);
  }

  native.closePath();
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

  const resolved: ResolvedLayer[] = layers
    .map(l => resolveLayerForVariant(l, variant))
    .filter(l => l.resolvedVisible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of resolved) {
    const ctxAny = ctx.native as CanvasRenderingContext2D;
    ctxAny.save();

    // Combined CSS filter (image color adjustments + surface blur). Saved/restored with the context.
    const blurEffect = layer.resolvedEffects?.find((effect) => effect.kind === 'surface-blur' && effect.enabled);
    const blurPx = blurEffect ? Number(blurEffect.params.radius ?? 0) : 0;
    const filterStr = [imageFilterToCss(layer.imageFilter), blurPx > 0 ? `blur(${blurPx}px)` : ''].filter(Boolean).join(' ');
    if (filterStr) ctxAny.filter = filterStr;

    if (layer.resolvedBlendMode && layer.resolvedBlendMode !== 'normal') {
      backend.applyBlendMode(ctx, layer.resolvedBlendMode);
    }

    if (layer.resolvedOpacity < 1) {
      backend.applyOpacity(ctx, layer.resolvedOpacity);
    }

    const shadow = layer.resolvedEffects?.find((effect) => effect.kind === 'depth-shadow' && effect.enabled);
    if (shadow) {
      ctxAny.shadowOffsetX = Number(shadow.params.x ?? 0);
      ctxAny.shadowOffsetY = Number(shadow.params.y ?? 14);
      ctxAny.shadowBlur = Number(shadow.params.blur ?? 28);
      ctxAny.shadowColor = String(shadow.params.color ?? 'rgba(15, 23, 42, 0.28)');
    }

    if (layer.resolvedTransform) {
      backend.applyTransform(ctx, layer.resolvedTransform);
    }

    if (layer.kind === 'text' && layer.resolvedText) {
      const text = layer.resolvedText;
      ctxAny.fillStyle = layer.resolvedFill?.kind === 'solid' ? layer.resolvedFill.color ?? '#111827' : '#111827';
      ctxAny.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
      ctxAny.textAlign = 'center';
      ctxAny.textBaseline = 'middle';
      ctxAny.fillText(text.content, canvasSize / 2, canvasSize / 2);
    }

    if (layer.resolvedSource.shape && layer.kind !== 'text') {
      const shape = layer.resolvedSource.shape;
      const x = (canvasSize - shape.width) / 2;
      const y = (canvasSize - shape.height) / 2;
      if (layer.resolvedFill) {
        ctxAny.save();
        traceShapePath(ctxAny, shape, x, y);
        ctxAny.clip();
        backend.applyFill(ctx, layer.resolvedFill, x, y, shape.width, shape.height);
        ctxAny.restore();
      }
      if (layer.resolvedStroke) {
        traceShapePath(ctxAny, shape, x, y);
        ctxAny.strokeStyle = layer.resolvedStroke.color;
        ctxAny.lineWidth = layer.resolvedStroke.width;
        ctxAny.stroke();
      }
    }

    if (layer.resolvedSource.type === 'inline' && layer.resolvedSource.data) {
      try {
        const mimeType = layer.resolvedSource.mimeType ?? 'image/png';
        const binary = atob(layer.resolvedSource.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        const img = await backend.loadImage(blob);
        const rect = getContainedRect(img.width, img.height, canvasSize);
        backend.drawImage(ctx, img, rect.x, rect.y, rect.width, rect.height);
      } catch {
        // Skip layers that fail to load
      }
    }

    if (layer.resolvedSource.type === 'reference' && layer.resolvedSource.path) {
      try {
        const img = await backend.loadImage(layer.resolvedSource.path);
        const rect = getContainedRect(img.width, img.height, canvasSize);
        backend.drawImage(ctx, img, rect.x, rect.y, rect.width, rect.height);
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
