import { describe, expect, it, vi } from 'vitest';
import type { ExportArtifactSpec, IconCoreProject, IconLayer } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { backgroundModeFor, encodeRaster } from '../src/encoders/raster';
import type { RasterFormat } from '../src/encoders/raster';

/**
 * The export used to inherit the variant's seeded background.
 *
 * `projectFactory` fills `light`/`dark`/`mono` with opaque colours so the editor
 * has something to show, and every exported PNG arrived as an opaque rectangle —
 * invisible on a dark tab, wrong on a light one, and not what anybody asked for.
 * Measured: 100% of pixels opaque, and at 16px the surviving `mono` render had
 * 0% colour and 2.17 contrast.
 *
 * These tests pin the decision: alpha by default, with the two cases that still
 * paint already expressible in the model.
 */

const layer = (): IconLayer => ({
  id: 'l1',
  name: 'shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 400, height: 400 } },
  transform: { x: 56, y: 56, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#3b82f6' }
});

/** A project that looks like a real one after the factory seeded it. */
const project = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' } },
  layers: [layer()],
  variants: {
    default: {},
    light: { canvas: { background: { kind: 'solid', color: '#f8fafc' } } },
    dark: { canvas: { background: { kind: 'solid', color: '#111827' } } },
    mono: { canvas: { background: { kind: 'solid', color: '#ffffff' } } }
  },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

/**
 * A backend that records the background paint, so the assertion is about what
 * the compositor was told to do rather than about pixels a mock cannot produce.
 */
const createRecordingBackend = (): RenderBackend & { calls: Array<{ fill: unknown; w: number; h: number }>; canvas: number } => {
  const calls: Array<{ fill: unknown; w: number; h: number }> = [];
  let canvas = 0;

  const makeCtx = (width: number, height: number): RenderContext => {
    canvas = Math.max(canvas, width);
    const native = {
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
      canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' }))) }
    };
    const ctx = { width, height, native } as unknown as RenderContext;
    return ctx;
  };

  const backend = {
    loadImage: vi.fn(async () => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn(makeCtx),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn((_ctx: RenderContext, fill: unknown, _x: number, _y: number, w: number, h: number) => {
      calls.push({ fill, w, h });
    }),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    destroy: vi.fn()
  } as unknown as RenderBackend & { calls: Array<{ fill: unknown; w: number; h: number }>; canvas: number };

  backend.calls = calls;
  Object.defineProperty(backend, 'canvas', { get: () => canvas });
  return backend;
};

type RasterArtifact = ExportArtifactSpec & { format: RasterFormat };

const artifact = (spec: Partial<ExportArtifactSpec> = {}): RasterArtifact => ({
  id: 'a1',
  format: 'png',
  path: 'icon.png',
  enabled: true,
  size: 512,
  ...spec
} as RasterArtifact);

/**
 * Background paints only — the compositor paints a full-canvas rect for the
 * background and per-layer rects for the artwork, so the distinguishing mark is
 * the arguments: the background call spans the whole canvas.
 */
const backgroundPaints = (backend: { calls: Array<{ fill: unknown; w: number; h: number }>; canvas: number }) =>
  backend.calls.filter((c) => c.w === backend.canvas && c.h === backend.canvas);

describe('export background: transparent by default', () => {
  it('paints no background for a plain PNG, even with a seeded opaque variant', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact(), project(), 'mono', backend);

    // `mono` seeds #ffffff; nothing should be painted full-canvas.
    expect(backgroundPaints(backend)).toEqual([]);
  });

  it('paints no background for every seeded variant', async () => {
    for (const variant of ['default', 'light', 'dark', 'mono'] as const) {
      const backend = createRecordingBackend();
      await encodeRaster(artifact(), project(), variant, backend);
      expect(backgroundPaints(backend)).toEqual([]);
    }
  });

  it('paints the canvas when the artifact requires an opaque background', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact({ background: 'opaque' }), project(), 'default', backend);

    // What `pwa-maskable-512` is: without a background a maskable icon crops.
    const painted = backgroundPaints(backend);
    expect(painted.length).toBeGreaterThan(0);
  });

  it('paints the canvas for JPEG, which cannot carry alpha', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact({ format: 'jpeg', path: 'icon.jpg' } as Partial<ExportArtifactSpec>), project(), 'default', backend);

    // Transparent would flatten to black, which is worse than the seeded colour.
    expect(backgroundPaints(backend).length).toBeGreaterThan(0);
  });
});

describe('backgroundModeFor', () => {
  it('is transparent for png/webp without a requirement', () => {
    expect(backgroundModeFor({ format: 'png' })).toBe('transparent');
    expect(backgroundModeFor({ format: 'webp' })).toBe('transparent');
    expect(backgroundModeFor({ format: 'png', background: 'transparent' })).toBe('transparent');
  });

  it('is canvas for an opaque requirement and for jpeg', () => {
    expect(backgroundModeFor({ format: 'png', background: 'opaque' })).toBe('canvas');
    expect(backgroundModeFor({ format: 'jpeg' })).toBe('canvas');
    expect(backgroundModeFor({ format: 'jpeg', background: 'transparent' })).toBe('canvas');
  });
});

describe('the editor is not affected', () => {
  it('still paints the canvas background when no mode is given', async () => {
    const { renderProject } = await import('@iconcore/renderer');
    const backend = createRecordingBackend();

    await renderProject(project(), 'dark', { width: 512, height: 512 }, backend);

    // Default stays `canvas`: PreviewCanvas and SizePreview must keep showing
    // the same picture the editor shows.
    expect(backgroundPaints(backend).length).toBeGreaterThan(0);
  });
});
