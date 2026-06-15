import type { RenderBackend, RenderContext, ImageHandle } from '../types';
import type { Fill, ShapeKind, BlendMode } from '@iconcore/shared';

type WorkerMessage =
  | { id: number; method: 'loadImage'; args: [string | Blob] }
  | { id: number; method: 'createCanvas'; args: [number, number] }
  | { id: number; method: 'drawImage'; args: [number, number, number, number, number, number] }
  | { id: number; method: 'applyTransform'; args: [number, { x: number; y: number; scale: number; rotation: number }] }
  | { id: number; method: 'applyMask'; args: [number, ShapeKind, number, number?] }
  | { id: number; method: 'applyFill'; args: [number, Fill, number, number, number, number] }
  | { id: number; method: 'applyOpacity'; args: [number, number] }
  | { id: number; method: 'applyBlendMode'; args: [number, BlendMode] }
  | { id: number; method: 'toBlob'; args: [number, string, number?] }
  | { id: number; method: 'resize'; args: [Blob, number, number, string?, number?] }
  | { id: number; method: 'destroy'; args: [] };

type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export interface WorkerBackend extends RenderBackend {
  terminate(): void;
}

export const createWorkerBackend = (): WorkerBackend => {
  const worker = new Worker(
    new URL('./worker-impl.ts', import.meta.url),
    { type: 'module' }
  );

  let nextId = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { id, ok } = event.data;
    const handler = pending.get(id);
    if (!handler) return;
    pending.delete(id);
    if (ok) {
      handler.resolve(event.data.result);
    } else {
      handler.reject(new Error(event.data.error));
    }
  };

  const call = <T>(method: WorkerMessage['method'], ...args: unknown[]): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ id, method, args } as WorkerMessage);
    });
  };

  const backend: WorkerBackend = {
    loadImage: (source: string | Blob) => call<ImageHandle>('loadImage', source),
    createCanvas: (width: number, height: number) => call<RenderContext>('createCanvas', width, height) as unknown as RenderContext,
    drawImage: (ctx: RenderContext, img: ImageHandle, dx: number, dy: number, dw: number, dh: number) => {
      call<void>('drawImage', (ctx.native as { id: number }).id, (img.native as { id: number }).id, dx, dy, dw, dh);
    },
    applyTransform: (ctx: RenderContext, transform: { x: number; y: number; scale: number; rotation: number }) => {
      call<void>('applyTransform', (ctx.native as { id: number }).id, transform);
    },
    applyMask: (ctx: RenderContext, shape: ShapeKind, size: number, radius?: number) => {
      call<void>('applyMask', (ctx.native as { id: number }).id, shape, size, radius);
    },
    applyFill: (ctx: RenderContext, fill: Fill, x: number, y: number, width: number, height: number) => {
      call<void>('applyFill', (ctx.native as { id: number }).id, fill, x, y, width, height);
    },
    applyOpacity: (ctx: RenderContext, opacity: number) => {
      call<void>('applyOpacity', (ctx.native as { id: number }).id, opacity);
    },
    applyBlendMode: (ctx: RenderContext, mode: BlendMode) => {
      call<void>('applyBlendMode', (ctx.native as { id: number }).id, mode);
    },
    toBlob: (ctx: RenderContext, format: string, quality?: number) => call<Blob>('toBlob', (ctx.native as { id: number }).id, format, quality),
    resize: (source: Blob, targetW: number, targetH: number, format?: string, quality?: number) => call<Blob>('resize', source, targetW, targetH, format, quality),
    destroy: () => {
      call<void>('destroy');
    },
    terminate: () => {
      worker.terminate();
      pending.clear();
    }
  };

  return backend;
};