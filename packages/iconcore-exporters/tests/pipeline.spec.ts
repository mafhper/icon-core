import { describe, expect, it, vi } from 'vitest';
import type {
  ExportContext,
  ExportPlan,
  IconCoreProject,
  IconVariant
} from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '@iconcore/renderer';
import { buildPlan, planFromTarget } from '../src/planner';
import { executePlan, planArtifacts, validatePlan, PlanValidationError, resolveArtifactPath } from '../src/pipeline';
import type { PlanProgress } from '../src/pipeline';
import { generatePreviewHtml } from '../src/pipeline';

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
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['fake-png'], { type: 'image/png' }))) }
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
    toBlob: vi.fn(async () => new Blob(['fake-png'], { type: 'image/png' })),
    resize: vi.fn(
      async (_src: Blob, w: number, h: number, format?: string, _quality?: number): Promise<Blob> =>
        new Blob([`png-${w}x${h}-${format ?? 'png'}`], { type: `image/${format ?? 'png'}` })
    ),
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

const ctx = (project?: IconCoreProject): ExportContext => ({
  project: project ?? createProject(),
  variants: ['default']
});

describe('resolveArtifactPath (path tokens, spec §4)', () => {
  it('substitutes {name}, {format}, {size}, {variant}, {target}', () => {
    const context = ctx(createProject({ exportProfile: { outputBaseName: 'my-icon', quality: 0.9, generateReport: false } }));
    const path = resolveArtifactPath(
      { id: 'a', format: 'png', path: 'icons/{name}-{size}.{format}', enabled: true, size: 64, target: 'web-favicon' },
      context,
      'dark',
      'web'
    );
    expect(path).toBe('icons/my-icon-64.png');
    expect(path).not.toContain('{');
  });

  it('never duplicates an extension (icon.png stays icon.png)', () => {
    const path = resolveArtifactPath({ id: 'a', format: 'png', path: 'icon.png', enabled: true, size: 32 }, ctx(), 'default', 'web');
    expect(path).toBe('icon.png');
  });

  it('appends the format extension when missing', () => {
    const path = resolveArtifactPath({ id: 'a', format: 'svg', path: 'logo', enabled: true, size: 128 }, ctx(), 'default', 'web');
    expect(path).toBe('logo.svg');
  });
});

describe('planArtifacts', () => {
  it('expands each enabled artifact, skips disabled ones', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [
        { id: 'a', format: 'png', path: 'a.png', enabled: true, size: 64 },
        { id: 'b', format: 'svg', path: 'b.svg', enabled: false, size: 128 }
      ],
      attachments: []
    };
    const planned = planArtifacts(plan, ctx());
    expect(planned).toHaveLength(1);
    expect(planned[0].path).toBe('a.png');
    expect(planned[0].kind).toBe('raster');
    expect(planned[0].size).toBe(64);
  });

  it('expands one PlannedArtifact per requested variant when artifact has none', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'png', path: '{variant}/a.png', enabled: true, size: 64 }],
      attachments: []
    };
    const variants: IconVariant[] = ['default', 'dark'];
    const planned = planArtifacts(plan, ctx(), { variants });
    expect(planned.map((p) => p.variant)).toEqual(['default', 'dark']);
    expect(planned.map((p) => p.path)).toEqual(['default/a.png', 'dark/a.png']);
  });

  it('keeps the explicit variant when the artifact declares one', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'png', path: '{variant}/a.png', enabled: true, size: 64, variant: 'mono' }],
      attachments: []
    };
    const planned = planArtifacts(plan, ctx(), { variants: ['default', 'dark'] });
    expect(planned.map((p) => p.variant)).toEqual(['mono']);
  });

  it('exposes container entries for the executor', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'ico', format: 'ico', path: 'icon.ico', enabled: true, entries: [16, 256] }],
      attachments: []
    };
    const [ico] = planArtifacts(plan, ctx());
    expect(ico.kind).toBe('container');
    expect(ico.entries).toEqual([16, 256]);
    expect(ico.size).toBe(256);
  });
});

describe('validatePlan (spec §6)', () => {
  it('reports structural problems (extension mismatch)', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'png', path: 'a.webp', enabled: true, size: 64 }],
      attachments: []
    };
    const validation = validatePlan(plan, ctx());
    expect(validation.ready).toBe(false);
    expect(validation.problems).toHaveLength(1);
    expect(validation.problems[0]).toContain('.png');
  });

  it('warns for JPEG without an alpha channel on a transparent project', () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'jpeg', path: 'a.jpg', enabled: true, size: 64 }],
      attachments: []
    };
    const project = createProject();
    project.canvas.background = { kind: 'none' } as never;
    const validation = validatePlan(plan, ctx(project));
    expect(validation.ready).toBe(true);
    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0]).toContain('alpha');
  });

  it('warns for opaque artifacts on a transparent project', () => {
    const plan: ExportPlan = {
      presetId: 'pwa',
      artifacts: [{ id: 'a', format: 'png', path: 'maskable.png', enabled: true, size: 512, background: 'opaque' }],
      attachments: []
    };
    const project = createProject();
    project.canvas.background = { kind: 'none' } as never;
    const validation = validatePlan(plan, ctx(project));
    expect(validation.warnings.some((warning) => warning.includes('opaque'))).toBe(true);
  });

  it('warns when an ICO pack lacks the recommended 256px entry', () => {
    const plan = planFromTarget(ctx(), 'tauri');
    const ico = plan.artifacts.find((artifact): artifact is import('@iconcore/shared').ExportContainerSpec =>
      artifact.format === 'ico'
    );
    expect(ico).toBeDefined();
    expect(ico?.entries).toContain(256);
    expect(validatePlan(plan, ctx()).warnings).toEqual([]);
  });
});

describe('executePlan — gate EX4 (no UI)', () => {
  it('executes a mixed svg+png+webp+ico plan into GeneratedFile[]', async () => {
    const project = createProject();
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [
        { id: 'svg', format: 'svg', path: 'icon.svg', enabled: true, size: 512 },
        { id: 'png32', format: 'png', path: 'icon-32.png', enabled: true, size: 32 },
        { id: 'webp64', format: 'webp', path: 'icon-64.webp', enabled: true, size: 64, quality: 0.8 },
        { id: 'ico', format: 'ico', path: 'icon.ico', enabled: true, entries: [16, 32] }
      ],
      attachments: []
    };
    const backend = createMockBackend();
    const result = await executePlan(plan, ctx(project), backend, { includeAttachments: false });

    const artifactFiles = result.files.filter((file) => file.kind === 'artifact');
    expect(artifactFiles.map((file) => file.path)).toEqual(['icon.svg', 'icon-32.png', 'icon-64.webp', 'icon.ico']);
    expect(artifactFiles.map((file) => file.mime)).toEqual([
      'image/svg+xml',
      'image/png',
      'image/webp',
      'image/x-icon'
    ]);
    expect(artifactFiles.every((file) => file.size > 0)).toBe(true);
    expect(result.planned).toHaveLength(4);
    backend.destroy();
  });

  it('throws PlanValidationError for an invalid plan', async () => {
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'png', path: 'a.txt', enabled: true, size: 64 }],
      attachments: []
    };
    await expect(executePlan(plan, ctx(), createMockBackend())).rejects.toThrow(PlanValidationError);
  });

  it('routes the legacy Tauri target through the plan (ico + icns produced)', async () => {
    const backend = createMockBackend();
    const plan = planFromTarget(ctx(), 'tauri');
    const result = await executePlan(plan, ctx(), backend, { includeAttachments: false });

    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('icon.ico');
    expect(paths).toContain('icon.icns');
    expect(paths).toContain('icons/icon.png');
    expect(result.files.find((file) => file.path === 'icon.ico')?.mime).toBe('image/x-icon');
    expect(result.files.find((file) => file.path === 'icon.icns')?.mime).toBe('image/icns');
    backend.destroy();
  });

  it('generates manifest/browserconfig attachments for the web preset', async () => {
    const backend = createMockBackend();
    const plan = buildPlan(ctx(), 'web');
    const result = await executePlan(plan, ctx(), backend);

    const attachmentPaths = result.files.filter((file) => file.kind === 'attachment').map((file) => file.path);
    expect(attachmentPaths).toContain('site.webmanifest');
    expect(attachmentPaths).toContain('browserconfig.xml');
    const manifest = result.files.find((file) => file.path === 'site.webmanifest')!;
    const parsed = JSON.parse(await manifest.blob.text());
    expect(parsed.name).toBe('Test');
    expect(parsed.icons.length).toBeGreaterThan(0);
    expect(parsed.icons.some((icon: { src: string }) => icon.src.endsWith('.png'))).toBe(true);
    backend.destroy();
  });

  it('generates README.md, iconcore-report.json and preview.html by default (parity with web export)', async () => {
    const backend = createMockBackend();
    const plan = planFromTarget(ctx(), 'pwa');
    const result = await executePlan(plan, ctx(), backend);

    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('manifest.webmanifest');
    expect(paths).toContain('README.md');
    expect(paths).toContain('iconcore-report.json');
    expect(paths).toContain('preview.html');
    expect(paths).not.toContain('WARNINGS.txt'); // no warnings expected here
    const readme = result.files.find((file) => file.path === 'README.md')!;
    expect(await readme.blob.text()).toContain('# Test — Icon Pack');
    const report = result.files.find((file) => file.path === 'iconcore-report.json')!;
    const parsedReport = JSON.parse(await report.blob.text());
    expect(parsedReport.artifacts.length).toBeGreaterThan(0);
    backend.destroy();
  });

  it('appends WARNINGS.txt when encoding warns', async () => {
    const backend = createMockBackend();
    const project = createProject();
    project.canvas.background = { kind: 'none' } as never;
    const plan: ExportPlan = {
      presetId: 'pwa',
      artifacts: [{ id: 'a', format: 'png', path: 'maskable.png', enabled: true, size: 512, background: 'opaque' }],
      attachments: []
    };
    const result = await executePlan(plan, ctx(project), backend, { includeAttachments: false });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.files.some((file) => file.path === 'WARNINGS.txt')).toBe(true);
    backend.destroy();
  });

  it('supports variant expansion through execution', async () => {
    const backend = createMockBackend();
    const variants: IconVariant[] = ['default', 'dark'];
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [{ id: 'a', format: 'png', path: '{variant}/icon.png', enabled: true, size: 64 }],
      attachments: []
    };
    const result = await executePlan(plan, ctx(), backend, { variants, includeAttachments: false });
    expect(result.files.map((file) => file.path)).toEqual(['default/icon.png', 'dark/icon.png']);
    backend.destroy();
  });
});

describe('executePlan — onProgress (EX5)', () => {
  it('reports planning, one tick per artifact, and finishes done', async () => {
    const backend = createMockBackend();
    const plan: ExportPlan = {
      presetId: 'custom',
      artifacts: [
        { id: 'svg', format: 'svg', path: 'icon.svg', enabled: true, size: 64 },
        { id: 'png', format: 'png', path: 'icon-64.png', enabled: true, size: 64 }
      ],
      attachments: []
    };
    const seen: PlanProgress[] = [];
    await executePlan(plan, ctx(), backend, {
      includeAttachments: false,
      onProgress: (progress) => seen.push(progress)
    });

    expect(seen[0]).toMatchObject({ phase: 'planning', completed: 0, total: 2, done: false });
    // One "before" + one "after" tick per artifact. Per-artifact ticks are
    // never `done`; only the final tick is (so a UI can treat `done` as
    // "execution finished").
    const perArtifact = seen.filter((progress) => !progress.done);
    expect(perArtifact.filter((p) => p.phase === 'encoding').map((p) => p.completed)).toEqual([0, 1, 1, 2]);
    expect(seen.filter((p) => p.done)).toHaveLength(1);
    expect(seen.at(-1)).toMatchObject({ done: true, total: 2, completed: 2 });
    // The current path is always a real planned artifact.
    const withPath = perArtifact.filter((p) => p.currentPath);
    expect(withPath.length).toBeGreaterThan(0);
    expect(withPath.every((p) => ['icon.svg', 'icon-64.png'].includes(p.currentPath!))).toBe(true);
    backend.destroy();
  });

  it('reports the attaching phase only when attachments are produced', async () => {
    const backend = createMockBackend();
    const plan = buildPlan(ctx(), 'pwa');

    const withAttachments: PlanProgress[] = [];
    await executePlan(plan, ctx(), backend, { onProgress: (p) => withAttachments.push(p) });
    expect(withAttachments.some((p) => p.phase === 'attaching')).toBe(true);

    const without: PlanProgress[] = [];
    await executePlan(plan, ctx(), backend, { includeAttachments: false, onProgress: (p) => without.push(p) });
    expect(without.some((p) => p.phase === 'attaching')).toBe(false);
    expect(without.at(-1)?.done).toBe(true);
    backend.destroy();
  });

  it('never throws when no callback is supplied', async () => {
    const backend = createMockBackend();
    const plan = buildPlan(ctx(), 'windows');
    await expect(executePlan(plan, ctx(), backend, { includeAttachments: false })).resolves.toBeDefined();
    backend.destroy();
  });
});

describe('generatePreviewHtml (moved from web)', () => {
  it('renders a contact sheet referencing image paths', () => {
    const html = generatePreviewHtml(createProject(), ['favicon-32x32.png']);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<img src="favicon-32x32.png"');
    expect(html).toContain('Icon Pack Preview');
  });
});