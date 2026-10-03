import { describe, expect, it } from 'vitest';

import type { ExportContext, ExportPlan } from '@iconcore/shared';
import { validatePlan } from '../src/pipeline';
import { planArtifacts, resolveArtifactPath } from '../src/pipeline/plan';

const context = (over: Partial<ExportContext> = {}): ExportContext =>
  ({
    project: {
      schemaVersion: 2,
      metadata: { name: 'Test', shortName: 'test' },
      canvas: { size: 512, background: { kind: 'solid', value: '#000000' } },
      exportProfile: {},
      variants: [],
      layers: []
    },
    ...over
  }) as ExportContext;

const artifact = (over: Record<string, unknown> = {}) =>
  ({
    id: 'web-png-16',
    enabled: true,
    format: 'png',
    path: 'favicon-16x16.png',
    size: 16,
    ...over
  }) as never;

const planOf = (artifacts: unknown[], presetId = 'custom'): ExportPlan =>
  ({ presetId, artifacts, attachments: [] }) as unknown as ExportPlan;

/**
 * The owner's report: on the Export screen, with the preset it starts on
 * ("Custom (start empty)"), ticking more than one variant made every artifact
 * collide and the export button stayed disabled.
 *
 * That preset declares no `variantLayout`, so the variant folder was never
 * added and all three variants resolved to the same path.
 */
describe('a plan that expands to several variants must be exportable', () => {
  const variants = ['default', 'light', 'dark'] as const;

  it('gives each variant its own folder on a preset that declares no layout', () => {
    const plan = planOf([artifact()]);

    const paths = planArtifacts(plan, context(), { variants: [...variants] }).map((p) => p.path);

    expect(paths).toEqual([
      'favicon-16x16.png',
      'light/favicon-16x16.png',
      'dark/favicon-16x16.png'
    ]);
    expect(new Set(paths).size).toBe(3);
  });

  it('validates clean, so the export is not blocked', () => {
    const plan = planOf([artifact()]);

    const result = validatePlan(plan, context(), { variants: [...variants] });

    expect(result.problems).toEqual([]);
    expect(result.ready).toBe(true);
  });

  it('covers the whole default plan: no artifact may collide', () => {
    // Every artifact the custom preset produces, at once, across three variants.
    const artifacts = [
      artifact({ id: 'a', path: 'favicon-16x16.png', size: 16 }),
      artifact({ id: 'b', path: 'favicon-32x32.png', size: 32 }),
      artifact({
        id: 'c',
        path: 'favicon.ico',
        format: 'ico',
        entries: [16, 32]
      }),
      artifact({ id: 'd', path: 'favicon.svg', format: 'svg' }),
      artifact({ id: 'e', path: 'icon-512x512.png', size: 512 })
    ];
    const plan = planOf(artifacts);

    const planned = planArtifacts(plan, context(), { variants: [...variants] });
    const paths = planned.map((p) => p.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(validatePlan(plan, context(), { variants: [...variants] }).ready).toBe(true);
  });

  it('keeps a single-variant plan byte-identical to before', () => {
    // The fix must not move any path in the common case: one variant, and the
    // preset saying nothing, has always produced the bare path.
    const plan = planOf([artifact()]);

    const [only] = planArtifacts(plan, context(), { variants: ['default'] });

    expect(only.path).toBe('favicon-16x16.png');
  });

  it('still honours an artifact that names its variant', () => {
    // The documented way to opt out: `{variant}` in the path already separates
    // the outputs, so no folder is added on top.
    const plan = planOf([artifact({ path: '{variant}/favicon-16x16.png' })]);

    const paths = planArtifacts(plan, context(), { variants: [...variants] }).map((p) => p.path);

    expect(paths).toEqual([
      'default/favicon-16x16.png',
      'light/favicon-16x16.png',
      'dark/favicon-16x16.png'
    ]);
  });

  it('does not double-fold a preset that already declares per-folder', () => {
    const plan = planOf([artifact()], 'web');

    const paths = planArtifacts(plan, context(), { variants: [...variants] }).map((p) => p.path);

    expect(paths.filter((p) => p.startsWith('light/'))).toHaveLength(1);
    expect(new Set(paths).size).toBe(3);
  });

  it('leaves an artifact pinned to one variant alone', () => {
    const plan = planOf([artifact({ variant: 'light' })]);

    const planned = planArtifacts(plan, context(), { variants: [...variants] });

    expect(planned).toHaveLength(1);
    expect(planned[0].path).toBe('favicon-16x16.png');
  });
});

describe('planner and validator resolve the same paths', () => {
  it('reports no problem exactly when the planned paths are unique', () => {
    // The two used to compute the variant set independently, which is how a
    // plan could validate clean and still collide when written. Asserting the
    // equivalence — unique planned paths ⇔ no problems — is what pins them
    // together; asserting "no problems" alone would pass if both were wrong in
    // the same way.
    const plan = planOf([artifact(), artifact({ id: 'b', path: 'other.png', size: 32 })]);
    const variantList = ['default', 'light', 'dark'] as const;

    const paths = planArtifacts(plan, context(), { variants: [...variantList] }).map((p) => p.path);
    const result = validatePlan(plan, context(), { variants: [...variantList] });

    expect(new Set(paths).size).toBe(paths.length);
    expect(result.problems).toEqual([]);
  });

  it('still catches a genuine duplicate between two artifacts', () => {
    // Two specs that both want `favicon-16x16.png`, one pinned to `dark` and
    // one generic. The pinned one resolves to the bare path and the generic one
    // puts `dark` in a folder, so they no longer clash — but they both claim
    // the root for different variants, and saying so is the honest answer.
    const plan = planOf([
      artifact({ id: 'pinned', variant: 'dark' }),
      artifact({ id: 'generic' })
    ]);
    const variantList = ['default', 'light', 'dark'] as const;

    const result = validatePlan(plan, context(), { variants: [...variantList] });

    expect(result.problems.join(' ')).toContain('favicon-16x16.png');
    expect(result.ready).toBe(false);
  });
});

describe('resolveArtifactPath', () => {
  it('still resolves a bare path when told nothing about variants', () => {
    expect(resolveArtifactPath(artifact(), context(), 'light')).toBe('favicon-16x16.png');
  });
});