import type { ShapeKind } from '@iconcore/shared';
import type { RenderContext } from '../types';

const clipCircle = (ctx: CanvasRenderingContext2D, size: number): void => {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
};

const clipRoundedRect = (ctx: CanvasRenderingContext2D, size: number, radius: number): void => {
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.closePath();
  ctx.clip();
};

const clipSquircle = (ctx: CanvasRenderingContext2D, size: number, curvature: number = 0.6): void => {
  const n = curvature;
  const s = size;
  const o = s * (1 - n) / 2;

  ctx.beginPath();
  ctx.moveTo(o, 0);
  ctx.bezierCurveTo(s - o, 0, s, o, s, s - o);
  ctx.bezierCurveTo(s, s - o, s - o, s, o, s);
  ctx.bezierCurveTo(o, s, 0, s - o, 0, o);
  ctx.bezierCurveTo(0, o, o, 0, o, 0);
  ctx.closePath();
  ctx.clip();
};

const clipSquare = (_ctx: CanvasRenderingContext2D, _size: number): void => {
  // No clipping needed for square
};

export const applyMask = (
  ctx: RenderContext,
  shape: ShapeKind,
  size: number,
  inset?: number
): void => {
  const native = ctx.native as CanvasRenderingContext2D;

  if (inset && inset > 0) {
    native.save();
    native.beginPath();
    native.rect(inset, inset, size - inset * 2, size - inset * 2);
    native.closePath();

    switch (shape) {
      case 'circle':
        native.beginPath();
        native.arc(size / 2, size / 2, (size - inset * 2) / 2, 0, Math.PI * 2);
        native.closePath();
        break;
      case 'rounded-rectangle':
        native.beginPath();
        native.roundRect(inset, inset, size - inset * 2, size - inset * 2, size * 0.2);
        native.closePath();
        break;
      case 'squircle':
        native.restore();
        native.save();
        clipSquircle(native, size - inset * 2, 0.6);
        native.translate(inset, inset);
        clipSquircle(native, size - inset * 2, 0.6);
        return;
      default:
        break;
    }

    native.clip();
    native.restore();
    return;
  }

  native.save();

  switch (shape) {
    case 'circle':
      clipCircle(native, size);
      break;
    case 'rounded-rectangle':
      clipRoundedRect(native, size, size * 0.2);
      break;
    case 'squircle':
      clipSquircle(native, size);
      break;
    default:
      clipSquare(native, size);
      break;
  }

  native.restore();
};

export { clipCircle, clipRoundedRect, clipSquircle, clipSquare };
