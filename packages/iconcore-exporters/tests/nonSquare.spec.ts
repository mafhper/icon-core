import { describe, expect, it, vi } from 'vitest';
import type { ExportArtifactSpec, IconCoreProject, IconLayer } from '@iconcore/shared';
import { isSquareSize, resolveSize } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { encodeRaster } from '../src/encoders';

/**
 * A backend whose `toBlob`/`resize` emit a **structurally valid PNG** whose
 * IHDR carries the requested pixel dimensions.
 *
 * Why this exists: asserting on `artifact.size` proves only that the model was
 * threaded through. The regression this guards (a 1200x630 OG image that came
 * out square) is about the **bytes on disk**, so the test has to read the
 * dimensions back out of a real PNG header. `DataView` + the PNG signature is
 * enough — no decoder needed, because IHDR is always the first chunk.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Read width/height out of the IHDR of a PNG blob. */
const readPngSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // 8-byte signature, then a 4-byte length and the "IHDR" type: data starts at 16.
  expect([...bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);
  const type = String.fromCharCode(...bytes.slice(12, 16));
  expect(type).toBe('IHDR');

  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
};

/** CRC-32 (PNG variant) so the emitted file is a legitimate PNG, not a lookalike. */
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)), false);
  return out;
};

/** A real PNG of the given size: signature + IHDR + a 1-byte IDAT + IEND. */
const makePng = (width: number, height: number): Blob => {
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10..12: compression, filter, interlace — all 0

  const parts = [
    new Uint8Array(PNG_SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array([0x78, 0x01])),
    chunk('IEND', new Uint8Array(0))
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return new Blob([out], { type: 'image/png' });
};

const emptyCtx = (): RenderContext => {
  const mockCtx = {
    fillRect: vi.fn(),
    fillStyle: '',
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' }))) }
  };
  return { width: 0, height: 0, native: mockCtx } as unknown as RenderContext;
};

/**
 * Backend that reports the dimensions it was asked for and emits a real PNG.
 *
 * `toBlob` mirrors the canvas it was created with, because `renderProject`
 * returns the composed blob directly when the target matches the canvas — no
 * resize happens on that path, so the composition's own size is what lands in
 * the file.
 */
const createSizeReportingBackend = (): RenderBackend => {
  let lastSize: { width: number; height: number } | null = null;
  let canvasSize: { width: number; height: number } = { width: 1, height: 1 };

  const backend = {
    loadImage: vi.fn(async () => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn((width: number, height: number) => {
      canvasSize = { width, height };
      const ctx = emptyCtx();
      (ctx as unknown as { width: number }).width = width;
      (ctx as unknown as { height: number }).height = height;
      return ctx;
    }),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => makePng(canvasSize.width, canvasSize.height)),
    resize: vi.fn(async (_src: Blob, width: number, height: number) => {
      lastSize = { width, height };
      return makePng(width, height);
    }),
    destroy: vi.fn()
  } as unknown as RenderBackend;

  (backend as unknown as { lastSize: () => unknown }).lastSize = () => lastSize;
  return backend;
};

const layer = (): IconLayer => ({
  id: 'l1',
  name: 'bg',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  role: 'background',
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 1200, height: 630 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#123456' }
});

/**
 * The raster path narrows the format, so build the artifact through that type.
 * `id` is required by the spec but unused by the encoder — the planner always
 * supplies one, so the fixture mirrors that rather than weakening the type.
 */
type RasterArtifact = ExportArtifactSpec & { format: 'png' };
const rasterArtifact = (spec: {
  id: string;
  path: string;
  size?: number;
  height?: number;
}): RasterArtifact => ({ format: 'png', enabled: true, ...spec });

const project = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: [layer()],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

describe('non-square dimensions — proven from the PNG bytes', () => {
  it('emits a real 1200x630 PNG when the artifact declares it', async () => {
    const backend = createSizeReportingBackend();

    const { blob } = await encodeRaster(
      rasterArtifact({ id: 'og', path: 'og-image.png', size: 1200, height: 630 }),
      project(),
      'default',
      backend
    );

    // The proof: dimensions read back out of the file's own IHDR chunk.
    expect(await readPngSize(blob)).toEqual({ width: 1200, height: 630 });
  });

  it('emits a square PNG when only size is declared (the pre-existing shape)', async () => {
    const backend = createSizeReportingBackend();

    const { blob } = await encodeRaster(
      rasterArtifact({ id: 'sq', path: 'icon-512.png', size: 512 }),
      project(),
      'default',
      backend
    );

    expect(await readPngSize(blob)).toEqual({ width: 512, height: 512 });
  });

  it('honours a non-square canvas, so no artifact size is needed', async () => {
    const backend = createSizeReportingBackend();
    const wide = project({ canvas: { size: 1200, height: 630, background: { kind: 'solid', color: '#ffffff' } } });

    const { blob } = await encodeRaster(
      rasterArtifact({ id: 'hero', path: 'hero.png' }),
      wide,
      'default',
      backend
    );

    expect(await readPngSize(blob)).toEqual({ width: 1200, height: 630 });
  });

  it('resolves the canvas pair through the one shared rule', () => {
    // The "one place that resolves dimensions" contract: callers must not
    // re-derive square/non-square, they ask `resolveSize`. The non-square case
    // is the load-bearing one — a `resolveSize` that ignored `height` would
    // still pass the square assertion above and quietly square every OG image.
    expect(resolveSize({ size: 512 })).toEqual({ width: 512, height: 512 });
    expect(resolveSize({ size: 1200, height: 630 })).toEqual({ width: 1200, height: 630 });
    expect(isSquareSize(resolveSize({ size: 512 }))).toBe(true);
    expect(isSquareSize(resolveSize({ size: 1200, height: 630 }))).toBe(false);
  });
});
