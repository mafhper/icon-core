import type { AngularGradientFill, DiamondGradientFill, Fill, GradientFill, ShapeKind, BlendMode } from '@iconcore/shared';
import type { ImageHandle, RenderBackend, RenderContext } from '../types';
import { toRgba } from '../color';
import { clamp01 } from '../color';
import { conicStartRadians, cssAngleVector, expandStops, sampleStops } from '../gradient';

const addStops = (gradient: CanvasGradient, fill: GradientFill): void => {
  for (const stop of expandStops(fill.stops)) {
    gradient.addColorStop(clamp01(stop.offset), stop.color);
  }
};

const buildGradient = (
  native: CanvasRenderingContext2D,
  fill: GradientFill,
  x: number,
  y: number,
  width: number,
  height: number
): CanvasGradient | null => {
  if (fill.kind === 'linear-gradient') {
    const { x: dx, y: dy } = cssAngleVector(fill.angle ?? 90);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2 || Math.max(width, height) / 2;
    const gradient = native.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    addStops(gradient, fill);
    return gradient;
  }

  if (fill.kind === 'radial-gradient') {
    const cx = x + width * (fill.centerX ?? 0.5);
    const cy = y + height * (fill.centerY ?? 0.5);
    const radius = Math.max(Math.max(width, height) * (fill.radius ?? 0.5), 0.0001);
    const gradient = native.createRadialGradient(cx, cy, 0, cx, cy, radius);
    addStops(gradient, fill);
    return gradient;
  }

  // angular-gradient → native conic when available.
  if (fill.kind !== 'angular-gradient') return null;
  const conic = (native as { createConicGradient?: (start: number, cx: number, cy: number) => CanvasGradient })
    .createConicGradient;
  if (typeof conic !== 'function') return null;
  const cx = x + width * (fill.centerX ?? 0.5);
  const cy = y + height * (fill.centerY ?? 0.5);
  const gradient = conic.call(native, conicStartRadians(fill.angle ?? 0), cx, cy);
  addStops(gradient, fill);
  return gradient;
};

/** Angular gradient fallback: concentric wedges (used when `createConicGradient` is missing). */
const paintAngularWedges = (
  native: CanvasRenderingContext2D,
  fill: AngularGradientFill,
  x: number,
  y: number,
  width: number,
  height: number,
  steps = 180
): void => {
  const cx = x + width * (fill.centerX ?? 0.5);
  const cy = y + height * (fill.centerY ?? 0.5);
  const radius = Math.hypot(width, height);
  const start = conicStartRadians(fill.angle ?? 0);

  native.save();
  native.beginPath();
  native.rect(x, y, width, height);
  native.clip();
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    native.beginPath();
    native.moveTo(cx, cy);
    native.arc(cx, cy, radius, start + t0 * Math.PI * 2, start + t1 * Math.PI * 2);
    native.closePath();
    native.fillStyle = sampleStops(fill.stops, (t0 + t1) / 2);
    native.fill();
  }
  native.restore();
};

/** Diamond gradient approximation: nested diamonds from the edge inward. */
const paintDiamond = (
  native: CanvasRenderingContext2D,
  fill: DiamondGradientFill,
  x: number,
  y: number,
  width: number,
  height: number,
  steps = 96
): void => {
  const cx = x + width * (fill.centerX ?? 0.5);
  const cy = y + height * (fill.centerY ?? 0.5);
  const reach = Math.max(width, height) * (fill.radius ?? 0.5);

  native.save();
  native.beginPath();
  native.rect(x, y, width, height);
  native.clip();
  // Corners keep the outermost colour.
  native.fillStyle = sampleStops(fill.stops, 1);
  native.fillRect(x, y, width, height);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = reach * (1 - t);
    native.beginPath();
    native.moveTo(cx, cy - r);
    native.lineTo(cx + r, cy);
    native.lineTo(cx, cy + r);
    native.lineTo(cx - r, cy);
    native.closePath();
    native.fillStyle = sampleStops(fill.stops, 1 - t);
    native.fill();
  }
  native.restore();
};


const loadImageBrowser = async (source: string | Blob): Promise<ImageHandle> => {
  if (typeof source === 'string') {
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, native: img });
      img.onerror = () => reject(new Error(`Failed to load image: ${source}`));
      img.src = source;
    });
  }

  try {
    const bitmap = await createImageBitmap(source);
    return { width: bitmap.width, height: bitmap.height, native: bitmap };
  } catch {
    const url = URL.createObjectURL(source);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight, native: img });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image from blob'));
      };
      img.src = url;
    });
  }
};

/** Normalize a format token ('png' | 'webp' | 'jpeg'/'jpg' | 'image/*') to a MIME type. */
const mimeFor = (format: string): string => {
  if (format.startsWith('image/')) return format === 'image/jpg' ? 'image/jpeg' : format;
  if (format === 'jpg' || format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
};

const BLEND_MODE_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  'normal': 'source-over',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten'
};

const applyAlphaMask = (
  native: CanvasRenderingContext2D,
  shape: ShapeKind,
  size: number,
  inset: number = 0
): void => {
  const x = inset;
  const y = inset;
  const width = Math.max(0, size - inset * 2);
  const height = Math.max(0, size - inset * 2);

  native.save();
  native.globalCompositeOperation = 'destination-in';
  native.fillStyle = '#000000';
  native.beginPath();

  if (shape === 'circle') {
    native.arc(size / 2, size / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  } else if (shape === 'rounded-rectangle') {
    native.roundRect(x, y, width, height, size * 0.2);
  } else if (shape === 'squircle') {
    const curvature = 0.6;
    const offset = width * (1 - curvature) / 2;
    native.moveTo(x + offset, y);
    native.bezierCurveTo(x + width - offset, y, x + width, y + offset, x + width, y + height - offset);
    native.bezierCurveTo(x + width, y + height - offset, x + width - offset, y + height, x + offset, y + height);
    native.bezierCurveTo(x + offset, y + height, x, y + height - offset, x, y + offset);
    native.bezierCurveTo(x, y + offset, x + offset, y, x + offset, y);
  } else {
    native.rect(x, y, width, height);
  }

  native.closePath();
  native.fill();
  native.restore();
};

export const createCanvasBackend = (): RenderBackend => {
  const cleanup: Array<() => void> = [];

  const backend: RenderBackend = {
    loadImage: loadImageBrowser,

    createCanvas(width: number, height: number): RenderContext {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) throw new Error('Canvas context unavailable');
      return { width, height, native: ctx };
    },

    drawImage(ctx: RenderContext, img: ImageHandle, dx: number, dy: number, dw: number, dh: number): void {
      const native = ctx.native as CanvasRenderingContext2D;
      if (img.native instanceof ImageBitmap || img.native instanceof HTMLImageElement) {
        native.drawImage(img.native as CanvasImageSource, dx, dy, dw, dh);
      }
    },

    applyTransform(ctx: RenderContext, transform: { x: number; y: number; scale: number; rotation: number }): void {
      const native = ctx.native as CanvasRenderingContext2D;
      native.translate(ctx.width / 2 + transform.x, ctx.height / 2 + transform.y);
      if (transform.rotation !== 0) {
        native.rotate((transform.rotation * Math.PI) / 180);
      }
      native.scale(transform.scale, transform.scale);
      native.translate(-ctx.width / 2, -ctx.height / 2);
    },

    applyMask(ctx: RenderContext, shape: ShapeKind, size: number, radius?: number): void {
      applyAlphaMask(ctx.native as CanvasRenderingContext2D, shape, size, radius);
    },

    applyFill(ctx: RenderContext, fill: Fill, x: number, y: number, width: number, height: number): void {
      const native = ctx.native as CanvasRenderingContext2D;

      if (fill.kind === 'none') {
        // No paint: preserve the alpha channel.
        return;
      }

      if (fill.kind === 'solid') {
        native.fillStyle = toRgba(fill.color ?? '#ffffff', fill.alpha ?? 1);
        native.fillRect(x, y, width, height);
        return;
      }

      if (fill.kind === 'diamond-gradient') {
        paintDiamond(native, fill, x, y, width, height);
        return;
      }

      const gradient = buildGradient(native, fill, x, y, width, height);
      if (gradient) {
        native.fillStyle = gradient;
        native.fillRect(x, y, width, height);
        return;
      }

      // Angular gradient without native conic support.
      if (fill.kind !== 'angular-gradient') return;
      paintAngularWedges(native, fill, x, y, width, height);
    },

    applyOpacity(ctx: RenderContext, opacity: number): void {
      const native = ctx.native as CanvasRenderingContext2D;
      native.globalAlpha = opacity;
    },

    applyBlendMode(ctx: RenderContext, mode: BlendMode): void {
      const native = ctx.native as CanvasRenderingContext2D;
      native.globalCompositeOperation = BLEND_MODE_MAP[mode] ?? 'source-over';
    },

    async toBlob(ctx: RenderContext, format: string, quality: number = 0.95): Promise<Blob> {
      const native = ctx.native as CanvasRenderingContext2D;
      const canvas = native.canvas;

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          },
          mimeFor(format),
          quality
        );
      });
    },

    async resize(source: Blob, targetW: number, targetH: number, format: string = 'png', quality?: number): Promise<Blob> {
      const img = await loadImageBrowser(source);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img.native as CanvasImageSource, 0, 0, targetW, targetH);

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Resize toBlob failed'));
          },
          mimeFor(format),
          quality
        );
      });
    },

    destroy(): void {
      for (const fn of cleanup) fn();
      cleanup.length = 0;
    }
  };

  return backend;
};
