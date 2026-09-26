import { describe, expect, it } from 'vitest';
import type { ExportContext, ExportContainerSpec, ExportPlan, IconTarget, IconVariant } from '@iconcore/shared';
import { buildPlan, planFromTarget, planProblems } from '../src/planner';
import { getAllPresets, getPreset, getPresetForTarget, PRESET_ID_BY_TARGET } from '../src/presets';
import { isContainerSpec } from '@iconcore/shared';

const ctx: ExportContext = {
  project: {
    schemaVersion: 3,
    metadata: { name: 'Test App', shortName: 'TestApp' },
    canvas: { size: 1024, background: { kind: 'solid', color: '#ffffff' } },
    layers: [],
    variants: { default: {} },
    targets: [],
    exportProfile: { outputBaseName: 'test-app', quality: 0.95, generateReport: false }
  },
  variants: ['default']
};

const enabledArtifacts = (plan: ExportPlan) => plan.artifacts.filter((artifact) => artifact.enabled);

const formats = (plan: ExportPlan) => new Set(enabledArtifacts(plan).map((artifact) => artifact.format));

const container = (plan: ExportPlan, format: 'ico' | 'icns'): ExportContainerSpec | undefined => {
  const found = enabledArtifacts(plan).find(
    (candidate) => isContainerSpec(candidate) && candidate.format === format
  );
  return found && isContainerSpec(found) ? found : undefined;
};

const paths = (plan: ExportPlan) => enabledArtifacts(plan).map((artifact) => artifact.path);

describe('presets (spec §3)', () => {
  it('registers the expected presets with unique ids', () => {
    const presets = getAllPresets();
    expect(presets.map((preset) => preset.id)).toEqual([
      'tauri',
      'electron',
      'web',
      'pwa',
      'windows',
      'macos',
      'desktop-generic',
      'marketing',
      'custom'
    ]);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
  });

  it('maps every legacy IconTarget id to a preset', () => {
    const targets: IconTarget[] = ['web-favicon', 'pwa', 'tauri', 'electron', 'desktop-generic', 'marketing'];
    for (const target of targets) {
      expect(PRESET_ID_BY_TARGET[target]).toBeDefined();
      expect(getPresetForTarget(target).id).toBe(PRESET_ID_BY_TARGET[target]);
    }
  });

  it('getPreset returns undefined for unknown ids; getPresetForTarget throws', () => {
    expect(getPreset('does-not-exist')).toBeUndefined();
    expect(() => getPresetForTarget('does-not-exist' as IconTarget)).toThrow(/No export preset/);
  });
});

describe('planning per target (spec §9: Domínio)', () => {
  it('Tauri: ico + icns + PNG set — NOT only PNGs (regression)', () => {
    const plan = planFromTarget(ctx, 'tauri');

    expect(formats(plan)).toEqual(new Set(['png', 'ico', 'icns']));
    expect(container(plan, 'ico')?.entries).toEqual([16, 24, 32, 48, 64, 256]);
    expect(container(plan, 'icns')?.entries).toEqual([16, 32, 64, 128, 256, 512, 1024]);
    expect(paths(plan)).toContain('icon.ico');
    expect(paths(plan)).toContain('icon.icns');
  });

  it('Electron: svg source + ico + icns + PNG set', () => {
    const plan = planFromTarget(ctx, 'electron');

    expect(formats(plan)).toEqual(new Set(['svg', 'png', 'ico', 'icns']));
    expect(container(plan, 'ico')?.entries).toContain(256);
    expect(paths(plan)).toContain('build/icon.ico');
    expect(paths(plan)).toContain('build/icon.icns');
  });

  it('Windows: exactly one ICO; macOS: exactly one ICNS', () => {
    // 'windows' is not a legacy target — use the preset id directly.
    const windows = buildPlan(ctx, 'windows');
    expect(enabledArtifacts(windows)).toHaveLength(1);
    expect(container(windows, 'ico')?.entries).toEqual([16, 24, 32, 48, 64, 256]);

    const macos = buildPlan(ctx, 'macos');
    expect(enabledArtifacts(macos)).toHaveLength(1);
    expect(container(macos, 'icns')?.entries).toEqual([16, 32, 64, 128, 256, 512, 1024]);
  });

  it('Web favicon: PNG/ICO/SVG set + apple-touch + manifest/browserconfig attachments', () => {
    const plan = planFromTarget(ctx, 'web-favicon');

    expect(formats(plan)).toEqual(new Set(['png', 'ico', 'svg']));
    expect(container(plan, 'ico')?.entries).toEqual([16, 32]);
    expect(paths(plan)).toContain('favicon-16x16.png');
    expect(paths(plan)).toContain('apple-touch-icon-180x180.png');
    expect(paths(plan)).toContain('favicon.svg');
    // Integration files come first, then the documentation companions. Every
    // produced file is declared, so the editor can show and disable it.
    expect(plan.attachments.map((attachment) => attachment.generator)).toEqual([
      'manifest',
      'browserconfig',
      'report',
      'preview',
      'readme'
    ]);
    expect(plan.attachments.map((attachment) => attachment.path)).toEqual([
      'site.webmanifest',
      'browserconfig.xml',
      'iconcore-report.json',
      'preview.html',
      'README.md'
    ]);
  });

  it('PWA: 192 + 512 + opaque maskable + manifest attachment', () => {
    const plan = planFromTarget(ctx, 'pwa');

    expect(paths(plan)).toEqual(['icon-192x192.png', 'icon-512x512.png', 'icon-maskable-512x512.png']);
    const maskable = enabledArtifacts(plan).find((artifact) => artifact.id === 'pwa-maskable-512');
    expect(maskable?.background).toBe('opaque');
    expect(plan.attachments.map((attachment) => attachment.path)).toEqual([
      'manifest.webmanifest',
      'iconcore-report.json',
      'preview.html',
      'README.md'
    ]);
  });

  it('Marketing: includes a 1024px PNG; Linux set is all PNGs', () => {
    const marketing = planFromTarget(ctx, 'marketing');
    const sizes = enabledArtifacts(marketing)
      .map((artifact) => artifact.size)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(sizes).toEqual([256, 512, 1024]);

    const linux = buildPlan(ctx, 'desktop-generic');
    expect(enabledArtifacts(linux).every((artifact) => artifact.format === 'png')).toBe(true);
    expect(enabledArtifacts(linux)).toHaveLength(4);
  });

  it('artifacts inherit the legacy target for traceability', () => {
    const plan = planFromTarget(ctx, 'tauri');
    expect(enabledArtifacts(plan).every((artifact) => artifact.target === 'tauri')).toBe(true);
  });
});

describe('buildPlan', () => {
  it('planFromTarget maps each legacy target to its preset', () => {
    const mappings: Array<[IconTarget, string]> = [
      ['web-favicon', 'web'],
      ['pwa', 'pwa'],
      ['tauri', 'tauri'],
      ['electron', 'electron'],
      ['desktop-generic', 'desktop-generic'],
      ['marketing', 'marketing']
    ];
    for (const [target, presetId] of mappings) {
      expect(planFromTarget(ctx, target).presetId).toBe(presetId);
    }
  });

  it('throws for unknown preset ids', () => {
    expect(() => buildPlan(ctx, 'does-not-exist')).toThrow(/Unknown export preset/);
  });

  it('custom preset produces an empty artifact scaffold with the standard companions', () => {
    const plan = buildPlan(ctx, 'custom');
    expect(plan.artifacts).toEqual([]);
    // A blank artifact list, but the documentation companions are still declared
    // (and can be switched off like any other attachment).
    expect(plan.attachments.map((attachment) => attachment.path)).toEqual([
      'iconcore-report.json',
      'preview.html',
      'README.md'
    ]);
    expect(plan.presetId).toBe('custom');
  });
});

describe('planProblems (invariants §0.5)', () => {
  const expectValid = (plan: ExportPlan) => expect(planProblems(plan)).toEqual([]);

  it('every preset plan is structurally valid', () => {
    for (const preset of getAllPresets()) {
      const plan = buildPlan(ctx, preset.id);
      expectValid(plan);
    }
  });

  it('flags a path whose extension does not match the format', () => {
    const plan = buildPlan(ctx, 'windows');
    plan.artifacts[0] = { ...plan.artifacts[0], path: 'icon.png' };
    const problems = planProblems(plan);
    expect(problems.some((problem) => problem.includes('does not match'))).toBe(true);
  });

  it('flags empty and invalid container entries', () => {
    const plan = buildPlan(ctx, 'windows');
    const ico = container(plan, 'ico');
    if (ico && isContainerSpec(ico)) {
      ico.entries = [];
    }
    const first = planProblems(plan);
    expect(first.some((problem) => problem.includes('has no entries'))).toBe(true);

    const plan2 = buildPlan(ctx, 'windows');
    const ico2 = container(plan2, 'ico');
    if (ico2 && isContainerSpec(ico2)) {
      ico2.entries = [0, 32];
    }
    const second = planProblems(plan2);
    expect(second.some((problem) => problem.includes('invalid container entry: 0'))).toBe(true);
  });

  it('flags duplicate artifact ids', () => {
    const plan = buildPlan(ctx, 'desktop-generic');
    plan.artifacts[1] = { ...plan.artifacts[1], id: plan.artifacts[0].id };
    expect(planProblems(plan).some((problem) => problem.includes('Duplicate artifact ids'))).toBe(true);
  });

  it('flags a raster artifact without a positive size', () => {
    const plan = buildPlan(ctx, 'desktop-generic');
    plan.artifacts[0] = { ...plan.artifacts[0], size: undefined };
    expect(planProblems(plan).some((problem) => problem.includes('needs a positive size'))).toBe(true);
  });

  it('ignores disabled artifacts', () => {
    const custom = buildPlan(ctx, 'custom');
    const withDisabled = { ...custom, artifacts: [{ ...custom.artifacts[0], enabled: false }] };
    expect(planProblems(withDisabled)).toEqual([]);
  });

  it('accepts multi-variant contexts', () => {
    const multiVar: ExportContext = { ...ctx, variants: ['default', 'dark'] as IconVariant[] };
    const plan = planFromTarget(multiVar, 'pwa');
    expectValid(plan);
  });
});