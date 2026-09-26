import { describe, expect, it, vi } from 'vitest';
import type { ExportContext, ExportPlan, IconCoreProject } from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '@iconcore/renderer';
import { exportTarget } from '../src/exportTarget';
import { buildPlan } from '../src/planner';
import { validatePlan } from '../src/pipeline';

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

const ctx = (project?: IconCoreProject): ExportContext => ({ project: project ?? createProject(), variants: ['default'] });

describe('exportTarget transparency requirements', () => {
  it('warns for artifacts that require an opaque background when the project is transparent', async () => {
    const backend = createMockBackend();
    const project = createProject({ canvas: { size: 512, background: { kind: 'none' } } });
    const result = await exportTarget(project, 'pwa', 'default', backend);
    const warnings = result.warnings.join('\n');
    expect(warnings).toContain('icon-maskable-512x512.png');
    // Non-maskable PWA icons accept alpha and must not be flagged.
    expect(warnings).not.toContain('"icon-192x192.png"');
    expect(warnings).not.toContain('"icon-512x512.png"');
    backend.destroy();
  });

  it('does not warn about transparency for an opaque project', async () => {
    const backend = createMockBackend();
    const result = await exportTarget(createProject(), 'pwa', 'default', backend);
    expect(result.warnings.some((w) => w.includes('opaque background'))).toBe(false);
    backend.destroy();
  });

  it('honours a transparent variant override', async () => {
    const backend = createMockBackend();
    const project = createProject({
      variants: { default: {}, dark: { canvas: { background: { kind: 'none' } } } }
    });
    const opaque = await exportTarget(project, 'pwa', 'default', backend);
    const transparent = await exportTarget(project, 'pwa', 'dark', backend);
    expect(opaque.warnings.some((w) => w.includes('opaque background'))).toBe(false);
    expect(transparent.warnings.some((w) => w.includes('opaque background'))).toBe(true);
    backend.destroy();
  });
});

describe('validatePlan transparency across the expanded variants', () => {
  const pwaPlan = (): ExportPlan => buildPlan(ctx(), 'pwa');

  it('warns when a non-default variant is transparent, even if default is opaque', () => {
    // The legacy per-target path received the variant explicitly; plan-level
    // validation must not lose that, or a transparent `dark` variant would
    // silently flatten the maskable icon.
    const project = createProject({
      variants: { default: {}, dark: { canvas: { background: { kind: 'none' } } } }
    });

    const onlyDefault = validatePlan(pwaPlan(), ctx(project), { variants: ['default'] });
    expect(onlyDefault.warnings.some((w) => w.includes('opaque background'))).toBe(false);

    const withDark = validatePlan(pwaPlan(), ctx(project), { variants: ['default', 'dark'] });
    const warning = withDark.warnings.find((w) => w.includes('opaque background'));
    expect(warning).toBeDefined();
    expect(warning).toContain('dark');
  });

  it('names the transparent variant in the warning', () => {
    const project = createProject({
      variants: { default: {}, dark: { canvas: { background: { kind: 'none' } } } }
    });
    const { warnings } = validatePlan(pwaPlan(), ctx(project), { variants: ['default', 'dark'] });
    expect(warnings.join('\n')).toContain('transparent in dark');
  });
});
