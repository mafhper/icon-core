import type { CanvasMaskShape, Dimensions, Fill, IconLayer, IconVariant, ShapeKind } from '@iconcore/shared';
import { imageFilterToCss, resolveMaskRadius } from '@iconcore/shared';
import type { RenderBackend, ResolvedLayer } from './types';
import { traceSuperellipse } from './geometry/superellipse';
import { layerBaseRect } from './geometry';
import { clipSquircle } from './masks/applyMask';
import { applySvgPaintOverrides } from './svgPaint';

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
    resolvedEffects: overrides?.effects ?? layer.effects,
    // Merged, not replaced: a variant that recolors one paint keeps the layer's others.
    resolvedSvgPaintOverrides:
      overrides?.svgPaintOverrides || layer.svgPaintOverrides
        ? { ...layer.svgPaintOverrides, ...overrides?.svgPaintOverrides }
        : undefined
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
    // The one definition, shared with the SVG pipeline and with the mask in
    // `backends/canvas.ts`. This branch used to use `min(width, height) * 0.22`
    // on both axes with control points at the midpoints, while the mask used
    // `width * (1 - 0.6) / 2` for both — two curves for one word, which is how
    // the canvas and the SVG export drifted apart (measured: 10,2% of pixels
    // outside tolerance, visible as a rounded rect in SVG).
    traceSuperellipse(native, x, y, width, height);
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
  canvas: Dimensions,
  background: Fill,
  variant: IconVariant,
  safeArea: { inset: number; shape: ShapeKind } | undefined,
  backend: RenderBackend,
  /** When set, the finished image is clipped to this outline. See clipToShape. */
  clipShape?: CanvasMaskShape,
  /**
   * The project's own canvas, read for the declared `maskRadius`. Falls back to
   * `canvas` when omitted, so a caller with no project still clips — it just
   * uses the shape default.
   */
  projectCanvas?: { size: number; height?: number; maskRadius?: number; maskShape?: CanvasMaskShape }
): Promise<Blob> => {
  const ctx = backend.createCanvas(canvas.width, canvas.height);
  const ctxAny = ctx.native as CanvasRenderingContext2D;

  /**
   * The canvas mask is clipped **before** anything is drawn.
   *
   * `clip()` in Canvas2D is not a filter over the finished image: it changes
   * what subsequent drawing operations are allowed to touch. A clip applied
   * after the layers are painted brackets nothing, and the render comes back
   * unclipped. This version did exactly that — the outline was traced after the
   * last layer, which is why measuring the PNGs showed `mask: 'rounded-rectangle'`
   * and `mask: 'none'` producing byte-identical output.
   *
   * So the order is: establish the clip, paint, encode. `applyMask` cannot do
   * this either, because it saves and restores around the clip, which cancels it.
   */
  if (clipShape) {
    clipToShape(ctxAny, canvas, clipShape, projectCanvas ?? {
      size: canvas.width,
      height: canvas.height,
      maskShape: clipShape
    });
  }

  // `kind: 'none'` means "no background paint" — keep the alpha channel.
  if (background.kind !== 'none') {
    backend.applyFill(ctx, background, 0, 0, canvas.width, canvas.height);
  }

  const resolved: ResolvedLayer[] = layers
    .map(l => resolveLayerForVariant(l, variant))
    // The background layer is a UI handle for `canvas.background`; it never
    // contributes pixels.
    .filter(l => l.resolvedVisible && l.role !== 'background')
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
      ctxAny.fillText(text.content, canvas.width / 2, canvas.height / 2);
    }

    if (layer.resolvedSource.shape && layer.kind !== 'text') {
      const shape = layer.resolvedSource.shape;
      const x = (canvas.width - shape.width) / 2;
      const y = (canvas.height - shape.height) / 2;
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

        /**
         * `IC63/1b` — the canvas half of the recolor.
         *
         * The canvas rasterizes the asset through `Image`, so there is no paint model to
         * write into: the only place the color exists is **the markup**, and it has to be
         * rewritten *before* it becomes a blob. Same pure function the SVG pipeline
         * calls (`applySvgPaintOverrides`), which is what keeps the two renderings from
         * drifting — `IC-N28` happened because the rewrite would have been written twice.
         *
         * The recolored path builds the blob from the **text bytes** instead of decoding
         * base64 and re-encoding it: the round trip would be pure waste, and this is the
         * only place in the renderer where a Blob is built from markup.
         *
         * Guarded on there being overrides, so the overwhelmingly common case — an SVG
         * nobody recolored — takes the exact same bytes it always did.
         */
        const overrides = layer.resolvedSvgPaintOverrides;
        const temOverride = overrides && Object.keys(overrides).length > 0;
        const ehSvg = mimeType === 'image/svg+xml';

        let blob: Blob;
        if (temOverride && ehSvg) {
          const markup = atob(layer.resolvedSource.data);
          blob = new Blob([new TextEncoder().encode(applySvgPaintOverrides(markup, overrides))], {
            type: mimeType
          });
        } else {
          const binary = atob(layer.resolvedSource.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blob = new Blob([bytes], { type: mimeType });
        }

        const img = await backend.loadImage(blob);
        const rect = layerBaseRect({ source: layer.resolvedSource }, canvas, img);
        backend.drawImage(ctx, img, rect.cx - rect.w / 2, rect.cy - rect.h / 2, rect.w, rect.h);
      } catch {
        // Skip layers that fail to load
      }
    }

    if (layer.resolvedSource.type === 'reference' && layer.resolvedSource.path) {
      try {
        const img = await backend.loadImage(layer.resolvedSource.path);
        const rect = layerBaseRect({ source: layer.resolvedSource }, canvas, img);
        backend.drawImage(ctx, img, rect.cx - rect.w / 2, rect.cy - rect.h / 2, rect.w, rect.h);
      } catch {
        // Skip layers that fail to load
      }
    }

    ctxAny.restore();
  }

  if (safeArea) {
    // Safe area is a square preview GUIDE by contract and never clips an export; a
    // non-square guide is out of scope here, so the inset stays relative to `width`.
    backend.applyMask(ctx, safeArea.shape, canvas.width, safeArea.inset * canvas.width);
  }

  return backend.toBlob(ctx, 'image/png');
};

/**
 * Clip the finished composition to the canvas outline.
 *
 * `canvas` here is the project's canvas, not the render target: the radius is
 * **read from the document** through `resolveMaskRadius`, so a radius the owner
 * set is the radius that appears. Recomputing the shape default inside this
 * function would silently ignore `canvas.maskRadius` — which is exactly what a
 * first version did, and what the test caught (asked for 22, got 24).
 */
const clipToShape = (
  native: CanvasRenderingContext2D,
  target: { width: number; height: number },
  shape: CanvasMaskShape,
  projectCanvas: { size: number; height?: number; maskRadius?: number }
): void => {
  const { width, height } = target;
  const radius = Math.min(
    resolveMaskRadius(projectCanvas),
    Math.min(width, height) / 2
  );

  native.save();
  native.beginPath();
  switch (shape) {
    case 'circle':
      native.ellipse(width / 2, height / 2, Math.min(width, height) / 2, Math.min(width, height) / 2, 0, 0, Math.PI * 2);
      break;
    case 'squircle':
      clipSquircle(native, Math.min(width, height));
      break;
    default:
      native.roundRect(0, 0, width, height, radius);
      break;
  }
  native.closePath();
  native.clip();
  // Intentionally no `restore()`: the clip must survive until `toBlob`. The
  // context is discarded right after, so there is nothing to leak into.
};
