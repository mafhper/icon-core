import { createCanvasBackend } from './canvas';
import type { RenderBackend, RenderContext, ImageHandle } from '../types';
import type { Fill, ShapeKind, BlendMode } from '@iconcore/shared';

const backend: RenderBackend = createCanvasBackend();
const contexts = new Map<number, RenderContext>();
const images = new Map<number, ImageHandle>();
let nextCtxId = 0;
let nextImgId = 0;

type IncomingMessage = {
  id: number;
  method: string;
  args: unknown[];
};

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const { id, method, args } = event.data;

  try {
    let result: unknown;

    switch (method) {
      case 'loadImage': {
        const img = await backend.loadImage(args[0] as string | Blob);
        const imgId = nextImgId++;
        images.set(imgId, img);
        result = { id: imgId, width: img.width, height: img.height };
        break;
      }
      case 'createCanvas': {
        const ctx = backend.createCanvas(args[0] as number, args[1] as number);
        const ctxId = nextCtxId++;
        contexts.set(ctxId, ctx);
        result = { id: ctxId, width: ctx.width, height: ctx.height };
        break;
      }
      case 'drawImage': {
        const ctx = contexts.get(args[0] as number)!;
        const img = images.get(args[1] as number)!;
        backend.drawImage(ctx, img, args[2] as number, args[3] as number, args[4] as number, args[5] as number);
        result = undefined;
        break;
      }
      case 'applyTransform': {
        const ctx = contexts.get(args[0] as number)!;
        backend.applyTransform(ctx, args[1] as { x: number; y: number; scale: number; rotation: number });
        result = undefined;
        break;
      }
      case 'applyMask': {
        const ctx = contexts.get(args[0] as number)!;
        backend.applyMask(ctx, args[1] as ShapeKind, args[2] as number, args[3] as number | undefined);
        result = undefined;
        break;
      }
      case 'applyFill': {
        const ctx = contexts.get(args[0] as number)!;
        backend.applyFill(ctx, args[1] as Fill, args[2] as number, args[3] as number, args[4] as number, args[5] as number);
        result = undefined;
        break;
      }
      case 'applyOpacity': {
        const ctx = contexts.get(args[0] as number)!;
        backend.applyOpacity(ctx, args[1] as number);
        result = undefined;
        break;
      }
      case 'applyBlendMode': {
        const ctx = contexts.get(args[0] as number)!;
        backend.applyBlendMode(ctx, args[1] as BlendMode);
        result = undefined;
        break;
      }
      case 'toBlob': {
        const ctx = contexts.get(args[0] as number)!;
        const blob = await backend.toBlob(ctx, args[1] as string, args[2] as number | undefined);
        result = blob;
        break;
      }
      case 'resize': {
        const blob = await backend.resize(args[0] as Blob, args[1] as number, args[2] as number, args[3] as string | undefined, args[4] as number | undefined);
        result = blob;
        break;
      }
      case 'destroy': {
        backend.destroy();
        contexts.clear();
        images.clear();
        result = undefined;
        break;
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message });
  }
};