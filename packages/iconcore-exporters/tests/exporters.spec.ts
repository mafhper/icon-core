import { describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '@iconcore/renderer';
import { exportTarget, exportAllTargets } from '../src/exportTarget';
import { getAllPresets } from '../src/presets';
import { generateReport } from '../src/report';

function createMockBackend(): RenderBackend {
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
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' }))) }
  };

  return {
    loadImage: vi.fn(async (): Promise<ImageHandle> => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn((width: number, height: number): RenderContext => ({ width, height, native: mockCtx })),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['test'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['test'], { type: 'image/png' })),
    destroy: vi.fn()
  };
}

const createProject = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: [],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

/**
 * `exportTarget` is now a thin adapter over the plan pipeline — it exists only
 * so the CLI keeps its `ExportResult` contract. The source of truth for what a
 * target produces is the preset registry, so these tests assert the *corrected*
 * sets (the old `RasterTask` lists were PNG-only, which is what IC15 fixed).
 */
describe('exportTarget (plan adapter)', () => {
  it('exports web-favicon as the corrected favicon set (incl. ico + svg)', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'web-favicon', 'default', backend);

    expect(result.target).toBe('web-favicon');
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('favicon-16x16.png');
    expect(paths).toContain('favicon-32x32.png');
    // The regression this whole task existed for: containers and vectors too.
    expect(paths).toContain('favicon.ico');
    expect(paths).toContain('favicon.svg');
    backend.destroy();
  });

  it('exports pwa with the 192/512 pair plus the maskable variant', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'pwa', 'default', backend);

    expect(result.target).toBe('pwa');
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('icon-192x192.png');
    expect(paths).toContain('icon-512x512.png');
    expect(paths).toContain('icon-maskable-512x512.png');
    backend.destroy();
  });

  it('exports tauri with icon.ico AND icon.icns (regression: never PNG-only)', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'tauri', 'default', backend);

    expect(result.target).toBe('tauri');
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('icon.ico');
    expect(paths).toContain('icon.icns');
    expect(result.files.find((file) => file.path === 'icon.ico')?.blob.type).toBe('image/x-icon');
    expect(result.files.find((file) => file.path === 'icon.icns')?.blob.type).toBe('image/icns');
    backend.destroy();
  });

  it('returns a warning and no files for an unknown target', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'unknown' as never, 'default', backend);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.files.length).toBe(0);
    backend.destroy();
  });

  it('hands the manifest back in the legacy field (the CLI writes it itself)', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'web-favicon', 'default', backend);

    expect(result.manifest).toBeDefined();
    expect((result.manifest as { name: string }).name).toBe('Test');
    // Attachments other than the manifest are not leaked into the file list.
    expect(result.files.some((file) => file.path.endsWith('.webmanifest'))).toBe(false);
    backend.destroy();
  });

  it('returns only artifacts (never attachments) in the file list', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'pwa', 'default', backend);

    expect(result.files.some((file) => file.path === 'README.md')).toBe(false);
    expect(result.files.some((file) => file.path === 'preview.html')).toBe(false);
    backend.destroy();
  });
});

describe('exportAllTargets', () => {
  it('runs several targets in order', async () => {
    const backend = createMockBackend();
    const results = await exportAllTargets(createProject(), 'default', ['web-favicon', 'tauri'], backend);

    expect(results.map((result) => result.target)).toEqual(['web-favicon', 'tauri']);
    expect(results.every((result) => result.files.length > 0)).toBe(true);
    backend.destroy();
  });
});

describe('preset registry supersedes the target registry', () => {
  it('exposes the 9 presets that replaced the 6 raster targets', () => {
    const ids = getAllPresets().map((preset) => preset.id);
    expect(ids).toEqual(
      expect.arrayContaining(['tauri', 'electron', 'web', 'pwa', 'windows', 'macos', 'desktop-generic', 'marketing', 'custom'])
    );
  });
});

describe('generateReport', () => {
  it('generates a report from export result', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'web-favicon', 'default', backend);
    const report = generateReport(result, project, 'default');

    expect(report.project.name).toBe('Test');
    expect(report.target).toBe('web-favicon');
    expect(report.files.length).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThan(0);
    backend.destroy();
  });
});
