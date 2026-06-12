import { describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '@iconcore/renderer';
import { exportTarget, getAllTargets, getTargetDefinition } from '../src/exportTarget';
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
  schemaVersion: 2,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: [],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

describe('getAllTargets', () => {
  it('returns all 6 targets', () => {
    const targets = getAllTargets();
    expect(targets.length).toBe(6);
  });

  it('includes web-favicon target', () => {
    const targets = getAllTargets();
    expect(targets.some(t => t.id === 'web-favicon')).toBe(true);
  });
});

describe('getTargetDefinition', () => {
  it('returns definition for valid target', () => {
    const def = getTargetDefinition('web-favicon');
    expect(def).toBeDefined();
    expect(def!.id).toBe('web-favicon');
  });

  it('returns undefined for unknown target', () => {
    const def = getTargetDefinition('unknown' as any);
    expect(def).toBeUndefined();
  });
});

describe('exportTarget', () => {
  it('exports web-favicon target with correct files', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'web-favicon', 'default', backend);

    expect(result.target).toBe('web-favicon');
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.some(f => f.path === 'favicon-16x16.png')).toBe(true);
    expect(result.files.some(f => f.path === 'favicon-32x32.png')).toBe(true);
    backend.destroy();
  });

  it('exports pwa target with correct files', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'pwa', 'default', backend);

    expect(result.target).toBe('pwa');
    expect(result.files.length).toBe(4);
    expect(result.files.some(f => f.path === 'icons/icon-192x192.png')).toBe(true);
    backend.destroy();
  });

  it('exports tauri target', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'tauri', 'default', backend);

    expect(result.target).toBe('tauri');
    expect(result.files.length).toBe(4);
    backend.destroy();
  });

  it('returns warning for unknown target', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'unknown' as any, 'default', backend);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.files.length).toBe(0);
    backend.destroy();
  });

  it('generates manifest for web-favicon', async () => {
    const backend = createMockBackend();
    const project = createProject();
    const result = await exportTarget(project, 'web-favicon', 'default', backend);

    expect(result.manifest).toBeDefined();
    expect((result.manifest as any).name).toBe('Test');
    backend.destroy();
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
