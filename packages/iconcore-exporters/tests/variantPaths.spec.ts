import { describe, expect, it, vi } from 'vitest';
import type { ExportContext, ExportPlan, IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { buildPlan } from '../src/planner';
import { executePlan, planArtifacts, resolveArtifactPath, validatePlan } from '../src/pipeline';

/**
 * The defect: an artifact with no explicit `variant` expands once per selected
 * variant, and every preset used to resolve all of them to the **same** path.
 * Three renders happened, three blobs were pushed, and the archive held one
 * file — the last write winning, silently. "I marked light, dark and mono and
 * got one icon" was not a mystery; it was arithmetic.
 */

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

const ctx = (project = createProject()): ExportContext => ({ project, variants: ['default'] });

const createBackend = (): RenderBackend => {
  const ctxStub = (): RenderContext =>
    ({
      width: 0,
      height: 0,
      native: {
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
      }
    }) as unknown as RenderContext;

  return {
    loadImage: vi.fn(async () => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn((width: number, height: number) => {
      const c = ctxStub();
      (c as unknown as { width: number }).width = width;
      (c as unknown as { height: number }).height = height;
      return c;
    }),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async (_s: Blob, w: number, h: number) => new Blob([`png-${w}x${h}`], { type: 'image/png' })),
    destroy: vi.fn()
  } as unknown as RenderBackend;
};

const ALL: IconVariant[] = ['default', 'light', 'dark', 'mono'];

describe('variant-aware paths (per-folder presets)', () => {
  it('keeps default at the declared root and folders the other variants', () => {
    const context = ctx();
    const artifact = { id: 'f16', format: 'png' as const, path: 'favicon-16x16.png', enabled: true, size: 16 };

    expect(resolveArtifactPath(artifact, context, 'default', 'web')).toBe('favicon-16x16.png');
    expect(resolveArtifactPath(artifact, context, 'light', 'web')).toBe('light/favicon-16x16.png');
    expect(resolveArtifactPath(artifact, context, 'dark', 'web')).toBe('dark/favicon-16x16.png');
    expect(resolveArtifactPath(artifact, context, 'mono', 'web')).toBe('mono/favicon-16x16.png');
  });

  it('gives three selected variants three distinct paths and three files', async () => {
    const context = ctx();
    const plan = buildPlan(context, 'web');

    const selected = ALL.slice(1); // what the export screen offers: light, dark, mono
    const planned = planArtifacts(plan, context, { variants: selected });

    expect(new Set(planned.map((p) => p.path)).size).toBe(planned.length);

    const result = await executePlan(plan, { project: context.project, variants: selected }, createBackend(), {
      variants: selected
    });

    const paths = result.files.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((p) => p.endsWith('favicon-16x16.png')).sort()).toEqual([
      'dark/favicon-16x16.png',
      'light/favicon-16x16.png',
      'mono/favicon-16x16.png'
    ]);
  });

  it('leaves an artifact pinned to one variant untouched', () => {
    const context = ctx();
    const artifact = { id: 'f16', format: 'png' as const, path: 'favicon-16x16.png', enabled: true, size: 16, variant: 'dark' as const };

    // Pinned artifacts are asked for one variant only, so the folder is noise.
    expect(resolveArtifactPath(artifact, context, 'dark', 'web')).toBe('dark/favicon-16x16.png');
  });

  it('does not double the folder when the declared path already names the variant', () => {
    const context = ctx();
    const artifact = { id: 'f16', format: 'png' as const, path: 'favicon-{variant}.png', enabled: true, size: 16 };

    expect(resolveArtifactPath(artifact, context, 'light', 'web')).toBe('favicon-light.png');
  });

  it('leaves platform presets on their contract paths', () => {
    const context = ctx();
    const tauri = { id: 'i32', format: 'png' as const, path: 'icons/32x32.png', enabled: true, size: 32 };

    // `tauri.conf.json` reads exactly this path; there is nowhere to put a folder.
    for (const variant of ALL) {
      expect(resolveArtifactPath(tauri, context, variant, 'tauri')).toBe('icons/32x32.png');
    }
  });
});

describe('path collisions block the export', () => {
  const collisionPlan = (presetId: string): ExportPlan => buildPlan(ctx(), presetId);

  it('accepts a multi-variant export on a per-folder preset', () => {
    const validation = validatePlan(collisionPlan('web'), ctx(), { variants: ['light', 'dark', 'mono'] });
    expect(validation.problems.filter((p) => p.includes('would be written by'))).toEqual([]);
    expect(validation.ready).toBe(true);
  });

  it('now exports a multi-variant plan on a shared-path preset, one folder per variant', () => {
    // This used to assert the opposite: a preset with no `variantLayout` made
    // every variant resolve to the same path, so the export was refused. The
    // refusal was correct — the paths really did collide — but it left the
    // owner with no way out except picking a different preset, which is what
    // the Export screen started on and so what they always landed in.
    //
    // Detecting the collision was the fix for silent overwriting. Making the
    // collision unreachable is the fix for the blocked button. Both are needed:
    // a plan can still collide for a real reason (two specs claiming one file),
    // and the validator still has to say so.
    const plan = collisionPlan('tauri');
    const validation = validatePlan(plan, ctx(), { variants: ['light', 'dark', 'mono'] });

    expect(validation.problems.filter((p) => p.includes('would be written by'))).toEqual([]);
    expect(validation.ready).toBe(true);

    // `default` keeps the path the platform config expects; the rest are
    // separated, the same contract the `web` preset uses for `/favicon.ico`.
    const paths = planArtifacts(plan, ctx(), { variants: ['default', 'light', 'dark', 'mono'] }).map(
      (p) => p.path
    );
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((p) => p.startsWith('light/'))).toHaveLength(paths.length / 4);
  });

  it('still refuses a real collision and names the variants', () => {
    const plan = collisionPlan('tauri');
    // Two specs pinned to the same variant, claiming the same path. No folder
    // can separate these — a pinned artifact expands to one variant, so it gets
    // no folder — which is exactly the case the folder rule cannot rescue and
    // the validator still has to report.
    plan.artifacts = [
      { id: 'one', format: 'png', path: 'icon.png', enabled: true, size: 512, variant: 'light' },
      { id: 'two', format: 'png', path: 'icon.png', enabled: true, size: 256, variant: 'light' }
    ];

    const validation = validatePlan(plan, ctx(), { variants: ['light', 'dark'] });
    const collision = validation.problems.find((p) => p.includes('would be written by'));

    expect(validation.ready).toBe(false);
    expect(collision).toBeDefined();
    // The message has to name the claimants, not just say "collision".
    expect(collision).toContain('one (light)');
    expect(collision).toContain('two (light)');
  });

  it('still accepts a single-variant export on a shared-path preset', () => {
    const validation = validatePlan(collisionPlan('tauri'), ctx(), { variants: ['default'] });
    expect(validation.problems.filter((p) => p.includes('would be written by'))).toEqual([]);
    expect(validation.ready).toBe(true);
  });

  it('catches two custom artifacts pointing at the same file', () => {
    const plan = buildPlan(ctx(), 'custom');
    plan.artifacts = [
      { id: 'a1', format: 'png', path: 'icon.png', enabled: true, size: 512 },
      { id: 'a2', format: 'png', path: 'icon.png', enabled: true, size: 256 }
    ];

    const validation = validatePlan(plan, ctx(), { variants: ['default'] });
    const collision = validation.problems.find((p) => p.includes('"icon.png"'));
    expect(collision).toBeDefined();
    expect(collision).toContain('a1');
    expect(collision).toContain('a2');
  });

  it('catches a companion file landing on an artifact path', () => {
    const plan = buildPlan(ctx(), 'custom');
    plan.artifacts = [{ id: 'a1', format: 'png', path: 'site.webmanifest', enabled: true, size: 512 }];
    plan.attachments = [{ path: 'site.webmanifest', generator: 'manifest' }];

    const validation = validatePlan(plan, ctx(), { variants: ['default'] });
    expect(validation.problems.some((p) => p.includes('site.webmanifest'))).toBe(true);
  });

  it('ignores disabled artifacts and disabled companions', () => {
    const plan = buildPlan(ctx(), 'custom');
    plan.artifacts = [
      { id: 'a1', format: 'png', path: 'icon.png', enabled: true, size: 512 },
      { id: 'a2', format: 'png', path: 'icon.png', enabled: false, size: 256 }
    ];

    expect(validatePlan(plan, ctx(), { variants: ['default'] }).ready).toBe(true);
  });
});
