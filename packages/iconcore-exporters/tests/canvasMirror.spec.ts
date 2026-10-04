import { describe, expect, it, vi } from 'vitest';
import type { ExportArtifactSpec, IconCoreProject, IconLayer } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { maskModeFor, encodeRaster } from '../src/encoders/raster';

/**
 * The owner asked for the plainest possible rule: **what is drawn in the editor
 * is what lands in the export.** If the frame is set to 22px, the file has 22px
 * corners.
 *
 * That needed two things that did not exist:
 *
 * 1. The canvas *shape* used to live only in the editor's UI state, so a shape
 *    chosen but not saved was invisible to anything reading the document. It is
 *    now `canvas.maskShape`.
 * 2. Nothing ever clipped the exported image. `applyMask` looks like it should —
 *    it saves, clips, and then immediately restores, which cancels the clip —
 *    so the export has always been full bleed.
 *
 * These tests pin the rule and, more importantly, the two places where it must
 * **not** apply: a container (`.ico`/`.icns`) and a PWA maskable tile, because in
 * both cases the platform states the contract, and guessing would break it.
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

const project = (canvas: Partial<IconCoreProject['canvas']> = {}): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' }, ...canvas },
  layers: [layer()],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
});

type RasterArtifact = ExportArtifactSpec & { format: 'png' };

const artifact = (spec: Partial<ExportArtifactSpec> = {}): RasterArtifact =>
  ({ id: 'a1', format: 'png', path: 'icon.png', enabled: true, size: 512, ...spec } as RasterArtifact);

/** Records the clip path the compositor set, if any. */
const createRecordingBackend = (): RenderBackend & { clips: Array<{ type: string; args: number[] }> } => {
  const clips: Array<{ type: string; args: number[] }> = [];
  let native: Record<string, unknown> = {};

  const makeCtx = (width: number, height: number): RenderContext => {
    native = {
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
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn((...args: number[]) => clips.push({ type: 'ellipse', args })),
      clip: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
      roundRect: vi.fn((...args: number[]) => clips.push({ type: 'roundRect', args })),
      canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' }))) }
    };
    return { width, height, native } as unknown as RenderContext;
  };

  const backend = {
    loadImage: vi.fn(async () => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn(makeCtx),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    destroy: vi.fn()
  } as unknown as RenderBackend & { clips: Array<{ type: string; args: number[] }> };

  backend.clips = clips;
  return backend;
};

const clipCalls = (b: { clips: Array<{ type: string; args: number[] }> }) =>
  b.clips.filter((c) => c.type !== 'clip' || c.args.length > 0);

describe('the export mirrors the canvas frame', () => {
  it('clips to the shape the canvas declares', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact(), project({ maskShape: 'rounded-rectangle' }), 'default', backend);

    const round = clipCalls(backend).find((c) => c.type === 'roundRect');
    expect(round).toBeDefined();
    // 0, 0, 512, 512, then the resolved radius.
    expect(round!.args.slice(0, 4)).toEqual([0, 0, 512, 512]);
  });

  it('uses the radius the owner set, not the shape default', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact(), project({ maskShape: 'rounded-rectangle', maskRadius: 22 }), 'default', backend);

    const round = clipCalls(backend).find((c) => c.type === 'roundRect');
    // 22px, which is what "I set 22px and that is what I want" means.
    expect(round!.args[4]).toBe(22);
  });

  it('clips a circle with an ellipse', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact(), project({ maskShape: 'circle' }), 'default', backend);

    expect(clipCalls(backend).some((c) => c.type === 'ellipse')).toBe(true);
  });

  it('stays full bleed when the canvas declares neither shape nor radius', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifact(), project(), 'default', backend);

    // Nothing declared means nothing assumed: an older project renders as it did.
    expect(clipCalls(backend)).toEqual([]);
  });
});

describe('where the mirror must not apply', () => {
  it('leaves a container full bleed — Windows/macOS apply the mask themselves', () => {
    const container = { format: 'ico' as const, background: undefined };
    expect(maskModeFor(container, project({ maskShape: 'circle' }))).toBe('none');
    expect(maskModeFor({ format: 'icns' as const }, project({ maskShape: 'circle' }))).toBe('none');
  });

  it('leaves an opaque artifact full bleed — a PWA maskable is cropped by the launcher', () => {
    const maskable = { format: 'png' as const, background: 'opaque' as const };
    expect(maskModeFor(maskable, project({ maskShape: 'circle' }))).toBe('none');
  });

  it('mirrors a plain png', () => {
    expect(maskModeFor({ format: 'png' }, project({ maskShape: 'rounded-rectangle' }))).toBe('rounded-rectangle');
    expect(maskModeFor({ format: 'webp' }, project({ maskRadius: 22 }))).toBe('rounded-rectangle');
  });

  it('defaults the shape to rounded-rectangle when only a radius was set', () => {
    // The radius alone still means "round the corners", and the initial editor
    // shape was rounded-rectangle, so that is the honest reading.
    expect(maskModeFor({ format: 'png' }, project({ maskRadius: 22 }))).toBe('rounded-rectangle');
  });

  it('the artifact own shape wins over the project', () => {
    // Android's `ic_launcher_round.png` exists to BE round. Without this the file is a
    // byte-for-byte copy of the square one, and the shape can only come from the project —
    // which is a single shape for the whole export.
    expect(maskModeFor({ format: 'png', maskShape: 'circle' }, project({ maskShape: 'squircle' }))).toBe(
      'circle'
    );
    // E o round do Android e' circle mesmo num projeto sem shape declarado.
    expect(maskModeFor({ format: 'png', maskShape: 'circle' }, project())).toBe('circle');
  });

  it('an artifact with no shape still follows the project', () => {
    // A regressão que importa: `maskShape` e' aditivo. Quem nunca pediu tem que receber a
    // mesma forma de sempre.
    expect(maskModeFor({ format: 'png' }, project({ maskShape: 'squircle' }))).toBe('squircle');
    expect(maskModeFor({ format: 'png' }, project())).toBe('none');
  });

  it('an opaque artifact stays full bleed even asking for a shape', () => {
    // Um PNG opaco recortado vira um disco com fundo transparente na borda — que é pior
    // que não recortar. A regra do opaco vem antes da forma, e antes dela mesmo.
    expect(maskModeFor({ format: 'png', background: 'opaque', maskShape: 'circle' }, project())).toBe(
      'none'
    );
  });
});
