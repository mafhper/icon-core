import type { Fill, ShapeKind, BlendMode } from '@iconcore/shared';
import type { ImageHandle, RenderBackend, RenderContext } from '../types';

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

      if (fill.kind === 'solid') {
        native.fillStyle = fill.color ?? '#ffffff';
        native.fillRect(x, y, width, height);
      } else if (fill.kind === 'linear-gradient') {
        const angle = (fill.angle ?? 0) * Math.PI / 180;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const length = Math.sqrt(width * width + height * height) / 2;
        const gradient = native.createLinearGradient(
          cx - Math.cos(angle) * length,
          cy - Math.sin(angle) * length,
          cx + Math.cos(angle) * length,
          cy + Math.sin(angle) * length
        );
        for (const stop of fill.stops ?? []) {
          gradient.addColorStop(stop.offset, stop.color);
        }
        native.fillStyle = gradient;
        native.fillRect(x, y, width, height);
      } else if (fill.kind === 'radial-gradient') {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const radius = Math.max(width, height) / 2;
        const gradient = native.createRadialGradient(cx, cy, 0, cx, cy, radius);
        for (const stop of fill.stops ?? []) {
          gradient.addColorStop(stop.offset, stop.color);
        }
        native.fillStyle = gradient;
        native.fillRect(x, y, width, height);
      }
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
          format === 'jpg' ? 'image/jpeg' : `image/${format}`,
          quality
        );
      });
    },

    async resize(source: Blob, targetW: number, targetH: number): Promise<Blob> {
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
          'image/png'
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
