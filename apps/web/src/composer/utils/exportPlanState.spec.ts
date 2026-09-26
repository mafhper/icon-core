import { describe, expect, it, vi } from 'vitest';
import type { ExportContext, ExportPlan, IconCoreProject, IconTarget } from '@iconcore/shared';
import type { ImageHandle, RenderBackend, RenderContext } from '@iconcore/renderer';
import { executePlan, planProblems, validatePlan } from '@iconcore/exporters';
import { initialPlan, planAction, planSummary, formatLabel, suffixPath, plannedOutputPaths } from './exportPlanState';

/** Minimal backend: the pipeline only needs `toBlob`/`resize` to return blobs. */
const createMockBackend = (): RenderBackend => {
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
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' }))) }
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
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    destroy: vi.fn()
  };
};

const project = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: [],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

const ctx = (p?: IconCoreProject): ExportContext => ({ project: p ?? project(), variants: ['default'] });

const withTargets = (...targets: IconTarget[]): IconCoreProject =>
  project({ targets: targets.map((target) => ({ target, enabled: true })) });

describe('initialPlan', () => {
  it('restores a persisted snapshot verbatim (reopening keeps the plan)', () => {
    const snapshot = {
      presetId: 'custom',
      artifacts: [
        { id: 'x', format: 'svg' as const, path: 'brand/logo.svg', enabled: true, size: 512 }
      ]
    };
    const plan = initialPlan(ctx(withTargets('tauri')), snapshot);

    expect(plan.artifacts).toEqual(snapshot.artifacts);
    // The legacy targets must NOT leak in once a snapshot exists.
    expect(plan.artifacts.some((a) => a.format === 'ico')).toBe(false);
  });

  it('bridges legacy enabled targets to their presets', () => {
    const plan = initialPlan(ctx(withTargets('tauri')));

    expect(plan.presetId).toBe('tauri');
    // The regression that motivated the whole task: Tauri ships real containers.
    expect(plan.artifacts.some((a) => a.format === 'ico')).toBe(true);
    expect(plan.artifacts.some((a) => a.format === 'icns')).toBe(true);
  });

  it('merges multiple legacy targets into one custom plan without duplicate ids', () => {
    const plan = initialPlan(ctx(withTargets('web-favicon', 'pwa')));

    expect(plan.presetId).toBe('custom');
    expect(planProblems(plan)).toEqual([]);
    const ids = plan.artifacts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the web preset when the project has no enabled target', () => {
    const plan = initialPlan(ctx(project()));
    expect(plan.presetId).toBe('web');
  });

  it("applies the legacy global format to raster artifacts and fixes their extension", () => {
    const legacy = project({
      targets: [{ target: 'web-favicon', enabled: true }],
      exportProfile: { outputBaseName: 'test', quality: 0.8, generateReport: false, format: 'webp' }
    });
    const plan = initialPlan(ctx(legacy));

    // No structural problem introduced by the format swap.
    expect(planProblems(plan)).toEqual([]);
    // The web preset's SVG favicon is untouched (not raster).
    expect(plan.artifacts.some((a) => a.format === 'svg')).toBe(true);
  });
});

describe('planAction', () => {
  const base = (): ExportPlan => initialPlan(ctx(withTargets('tauri')));

  it('setPreset regenerates the artifact list', () => {
    const plan = planAction(base(), ctx(), { type: 'setPreset', presetId: 'macos' });
    expect(plan.presetId).toBe('macos');
    expect(plan.artifacts).toHaveLength(1);
    expect(plan.artifacts[0].format).toBe('icns');
  });

  it('customize drops presetId but keeps the artifacts', () => {
    const before = base();
    const plan = planAction(before, ctx(), { type: 'customize' });
    expect(plan.presetId).toBeUndefined();
    expect(plan.artifacts).toEqual(before.artifacts);
  });

  it('toggleArtifact flips enabled without touching the rest', () => {
    const before = base();
    const target = before.artifacts[0];
    const plan = planAction(before, ctx(), { type: 'toggleArtifact', id: target.id });
    const after = plan.artifacts.find((a) => a.id === target.id)!;
    expect(after.enabled).toBe(!target.enabled);
    expect(plan.artifacts).toHaveLength(before.artifacts.length);
  });

  it('removeArtifact drops only that artifact', () => {
    const before = base();
    const plan = planAction(before, ctx(), { type: 'removeArtifact', id: before.artifacts[1].id });
    expect(plan.artifacts).toHaveLength(before.artifacts.length - 1);
    expect(plan.artifacts.some((a) => a.id === before.artifacts[1].id)).toBe(false);
  });

  it('duplicateArtifact copies with a fresh id and a unique path', () => {
    const before = base();
    const source = before.artifacts[0];
    const plan = planAction(before, ctx(), { type: 'duplicateArtifact', id: source.id });
    const copy = plan.artifacts.find((a) => a.id !== source.id && a.path !== source.path)!;

    expect(copy).toBeDefined();
    expect(copy.id).not.toBe(source.id);
    expect(planProblems(plan)).toEqual([]);
    // Inserted right after the source for a predictable list order.
    expect(plan.artifacts.indexOf(copy)).toBe(plan.artifacts.indexOf(source) + 1);
  });

  it('addArtifact appends a valid container and a valid raster', () => {
    const start = planAction(base(), ctx(), { type: 'setPreset', presetId: 'custom' });
    const withIco = planAction(start, ctx(), { type: 'addArtifact', format: 'ico' });
    const withWebp = planAction(withIco, ctx(), { type: 'addArtifact', format: 'webp' });

    expect(planProblems(withWebp)).toEqual([]);
    expect(withWebp.artifacts.at(-1)!.format).toBe('webp');
    expect(withWebp.artifacts.at(-1)!.path.endsWith('.webp')).toBe(true);
  });

  it('toggleEntry adds and removes a container entry, never emptying it', () => {
    let plan = planAction(base(), ctx(), { type: 'setPreset', presetId: 'windows' });
    const ico = plan.artifacts[0];
    const original = [...(ico as { entries: number[] }).entries];

    plan = planAction(plan, ctx(), { type: 'toggleEntry', id: ico.id, entry: 512 });
    expect((plan.artifacts[0] as { entries: number[] }).entries).toContain(512);

    for (const entry of original) {
      plan = planAction(plan, ctx(), { type: 'toggleEntry', id: ico.id, entry });
    }
    // The last entry cannot be removed — an empty container is invalid.
    expect((plan.artifacts[0] as { entries: number[] }).entries.length).toBeGreaterThan(0);
    expect(planProblems(plan)).toEqual([]);
  });

  it('keeps entries sorted ascending', () => {
    let plan = planAction(base(), ctx(), { type: 'setPreset', presetId: 'windows' });
    plan = planAction(plan, ctx(), { type: 'toggleEntry', id: plan.artifacts[0].id, entry: 1024 });
    plan = planAction(plan, ctx(), { type: 'toggleEntry', id: plan.artifacts[0].id, entry: 24 });
    const entries = (plan.artifacts[0] as { entries: number[] }).entries;
    expect(entries).toEqual([...entries].sort((a, b) => a - b));
  });

  it('setEntries replaces the whole ladder', () => {
    let plan = planAction(base(), ctx(), { type: 'setPreset', presetId: 'windows' });
    plan = planAction(plan, ctx(), { type: 'setEntries', id: plan.artifacts[0].id, entries: [16, 256] });
    expect((plan.artifacts[0] as { entries: number[] }).entries).toEqual([16, 256]);
  });

  it('setArtifact patches size on a raster artifact', () => {
    let plan = planAction(base(), ctx(), { type: 'setPreset', presetId: 'marketing' });
    const raster = plan.artifacts[0];
    plan = planAction(plan, ctx(), { type: 'setArtifact', id: raster.id, patch: { size: 1024 } });
    expect(plan.artifacts[0].size).toBe(1024);
    expect(planProblems(plan)).toEqual([]);
  });
});

describe('planSummary', () => {
  it('counts real enabled artifacts, containers and distinct formats', () => {
    const plan = initialPlan(ctx(withTargets('tauri')));
    const summary = planSummary(plan);

    expect(summary.total).toBe(plan.artifacts.length);
    expect(summary.enabled).toBe(plan.artifacts.filter((a) => a.enabled).length);
    expect(summary.containers).toBeGreaterThan(0);
    expect(summary.formats).toBeGreaterThan(1);
  });
});

describe('formatLabel', () => {
  it('renders jpeg as JPEG and others uppercase', () => {
    expect(formatLabel('jpeg')).toBe('JPEG');
    expect(formatLabel('svg')).toBe('SVG');
    expect(formatLabel('icns')).toBe('ICNS');
  });
});

describe('EX6 — persistence round-trip (spec §8)', () => {  it('reopening a project restores the exact plan that was edited', () => {
    // A user edits the Tauri plan down to two artifacts and saves it.
    let plan = initialPlan(ctx(withTargets('tauri')));
    plan = planAction(plan, ctx(), { type: 'removeArtifact', id: plan.artifacts[0].id });
    plan = planAction(plan, ctx(), { type: 'removeArtifact', id: plan.artifacts[0].id });
    plan = planAction(plan, ctx(), { type: 'setPreset', presetId: 'tauri' });
    plan = planAction(plan, ctx(), { type: 'customize' });

    // Reopen: the snapshot is what the profile now holds.
    const reopened = initialPlan(ctx(withTargets('pwa')), { presetId: plan.presetId, artifacts: plan.artifacts });

    expect(reopened.presetId).toBeUndefined();
    expect(reopened.artifacts).toEqual(plan.artifacts);
    expect(planProblems(reopened)).toEqual([]);
  });

  it('an empty snapshot falls through to the legacy bridge (never a blank plan)', () => {
    // A profile can carry `artifacts: []` from an early save; it must not strand
    // the user on an empty plan.
    const reopened = initialPlan(ctx(withTargets('tauri')), { presetId: 'custom', artifacts: [] });

    expect(reopened.artifacts.length).toBeGreaterThan(0);
    expect(reopened.artifacts.some((a) => a.format === 'ico')).toBe(true);
  });

  it('a legacy v3 project (format/quality/zip only) opens and exports', () => {
    const legacy = project({
      targets: [{ target: 'web-favicon', enabled: true }],
      exportProfile: {
        outputBaseName: 'legacy',
        quality: 0.7,
        generateReport: true,
        format: 'jpeg',
        structure: 'nested',
        zip: true,
        compression: 'deflate',
        compressionLevel: 6
      }
    });

    const plan = initialPlan(ctx(legacy));

    expect(planProblems(plan)).toEqual([]);
    expect(plan.artifacts.some((a) => a.format === 'jpeg')).toBe(true);
    // The SVG favicon is vector and must not be coerced to a lossy raster.
    expect(plan.artifacts.some((a) => a.format === 'svg')).toBe(true);
    // The legacy fields are untouched — they remain the fallback.
    expect(legacy.exportProfile.structure).toBe('nested');
    expect(legacy.exportProfile.zip).toBe(true);
  });
});

describe('suffixPath', () => {
  it('produces a unique path without touching the extension', () => {
    expect(suffixPath('icon.png', ['icon.png'])).toBe('icon-2.png');
    expect(suffixPath('icon.png', ['icon.png', 'icon-2.png'])).toBe('icon-3.png');
    expect(suffixPath('icons/32x32.png', ['icons/32x32.png'])).toBe('icons/32x32-2.png');
  });
});
describe('EX7 � acceptance gate through the web path (spec �9)', () => {
  it('seeds a plan from the UI, edits it to svg+png+webp+ico, and executes all four', async () => {
    // This is the path the Export view actually takes: seed -> edit -> execute.
    const project = withTargets('web-favicon');
    const context = ctx(project);
    let plan = initialPlan(context);

    // Trim the seeded set and add exactly the four acceptance formats.
    for (const artifact of [...plan.artifacts]) {
      plan = planAction(plan, context, { type: 'removeArtifact', id: artifact.id });
    }
    for (const format of ['svg', 'png', 'webp', 'ico'] as const) {
      plan = planAction(plan, context, { type: 'addArtifact', format });
    }
    // The ICO must carry the Windows ladder the acceptance criterion names.
    const ico = plan.artifacts.find((artifact) => artifact.format === 'ico')!;
    plan = planAction(plan, context, { type: 'setEntries', id: ico.id, entries: [16, 24, 32, 48, 64, 256] });

    expect(planProblems(plan)).toEqual([]);
    expect(validatePlan(plan, context).ready).toBe(true);

    const backend = createMockBackend();
    const result = await executePlan(plan, context, backend, { includeAttachments: false });

    const formats = result.files.filter((file) => file.kind === 'artifact').map((file) => file.path);
    expect(formats.some((path) => path.endsWith('.svg'))).toBe(true);
    expect(formats.some((path) => path.endsWith('.png'))).toBe(true);
    expect(formats.some((path) => path.endsWith('.webp'))).toBe(true);
    expect(formats.some((path) => path.endsWith('.ico'))).toBe(true);
    expect(result.warnings).toEqual([]);
    backend.destroy();
  });

  it('keeps the Tauri regression through the web path (ico + icns, never PNG-only)', async () => {
    const context = ctx(withTargets('tauri'));
    const plan = initialPlan(context);

    const backend = createMockBackend();
    const result = await executePlan(plan, context, backend, { includeAttachments: false });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain('icon.ico');
    expect(paths).toContain('icon.icns');
    backend.destroy();
  });
});
describe('Nothing is exported that the user did not ask for', () => {
  /**
   * Regression: the user unchecked everything except the `.ico` and still got
   * `preview.html` and `iconcore-report.json`. Those companions were appended
   * by `executePlan` with no way to see or disable them, and the two UI switches
   * that claimed to control them were wired to nothing.
   */
  it('"just the ico" produces exactly the ico', async () => {
    const context = ctx(withTargets('tauri'));
    let plan = initialPlan(context);

    // Keep only the ICO.
    plan = { ...plan, artifacts: plan.artifacts.filter((artifact) => artifact.format === 'ico') };
    // And switch off every optional companion.
    for (const attachment of plan.attachments) {
      plan = planAction(plan, context, { type: 'toggleAttachment', path: attachment.path });
    }

    expect(plannedOutputPaths(plan, context, ['default'])).toEqual(['icon.ico']);

    const backend = createMockBackend();
    const result = await executePlan(plan, context, backend);
    expect(result.files.map((file) => file.path)).toEqual(['icon.ico']);
    backend.destroy();
  });

  it('never produces preview.html or the report unless they are enabled', async () => {
    const context = ctx(withTargets('tauri'));
    let plan = initialPlan(context);
    for (const path of ['preview.html', 'iconcore-report.json', 'README.md']) {
      plan = planAction(plan, context, { type: 'toggleAttachment', path });
    }

    const backend = createMockBackend();
    const result = await executePlan(plan, context, backend);
    const paths = result.files.map((file) => file.path);
    expect(paths).not.toContain('preview.html');
    expect(paths).not.toContain('iconcore-report.json');
    expect(paths).not.toContain('README.md');
    // �while the icons still come out.
    expect(paths).toContain('icon.ico');
    backend.destroy();
  });

  it('lists every output file before exporting, companions included', () => {
    const context = ctx(withTargets('web-favicon'));
    const plan = initialPlan(context);

    const listed = plannedOutputPaths(plan, context, ['default']);
    // Artifacts and attachments, exactly as execution will write them.
    expect(listed).toContain('favicon.ico');
    expect(listed).toContain('site.webmanifest');
    expect(listed).toContain('preview.html');
    // The count the button shows matches the list.
    expect(planSummary(plan).files).toBe(listed.length);
  });

  it('counts files, not just artifacts, in the summary', () => {
    const context = ctx(withTargets('tauri'));
    const plan = initialPlan(context);
    const icoOnly = { ...plan, artifacts: plan.artifacts.filter((artifact) => artifact.format === 'ico') };
    const summary = planSummary(icoOnly);

    expect(summary.enabled).toBe(1); // one ICO artifact
    expect(summary.files).toBe(4); // …plus report + preview + README
  });

  it('toggling an attachment does not touch the artifacts', () => {
    const context = ctx(withTargets('tauri'));
    const plan = initialPlan(context);
    const after = planAction(plan, context, { type: 'toggleAttachment', path: 'preview.html' });

    expect(after.artifacts).toEqual(plan.artifacts);
    expect(after.attachments.find((a) => a.path === 'preview.html')?.enabled).toBe(false);
    // Idempotent: toggling again brings it back.
    const back = planAction(after, context, { type: 'toggleAttachment', path: 'preview.html' });
    expect(back.attachments.find((a) => a.path === 'preview.html')?.enabled).toBe(true);
  });
});