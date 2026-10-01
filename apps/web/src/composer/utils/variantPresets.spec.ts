import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { generateVariantPreset, isGeneratableVariant, projectVariants } from './variantPresets';
import { hexToRgb, relativeLuminance } from './color';
import { createBlankProject } from './projectFactory';

const layer = (id: string, color: string): IconLayer => ({
  id,
  name: id,
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'circle', width: 100, height: 100 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color }
});

const project = (...colors: string[]): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'T', shortName: 'T' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: colors.map((c, i) => layer(`l${i}`, c)),
  variants: {},
  targets: [],
  exportProfile: { outputBaseName: 't', quality: 0.95, generateReport: true }
});

/** A one-layer project, for cases that reach into `layers[0]`. */
const oneLayer = (): IconCoreProject => project('#ff0000');

const luminanceOf = (color?: string) => relativeLuminance(hexToRgb(color ?? '#000000')!);

describe('variant presets', () => {
  it('identifies generatable variants', () => {
    expect(isGeneratableVariant('dark')).toBe(true);
    expect(isGeneratableVariant('default')).toBe(false);
    expect(isGeneratableVariant('transparent')).toBe(false);
  });

  it('mono converts fills to gray with a white background', () => {
    const preset = generateVariantPreset(project('#ff0000'), 'mono');
    expect(preset.background).toEqual({ kind: 'solid', color: '#ffffff' });
    const fill = preset.layerFills.l0;
    const rgb = hexToRgb(fill?.kind === 'solid' ? fill.color! : '#000000')!;
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });

  it('dark lightens very dark fills and uses a dark background', () => {
    const preset = generateVariantPreset(project('#111111'), 'dark');
    expect(preset.background.kind === 'solid' ? preset.background.color : undefined).toBe('#0f172a');
    const fill = preset.layerFills.l0;
    expect(luminanceOf(fill?.kind === 'solid' ? fill.color : undefined)).toBeGreaterThan(luminanceOf('#111111'));
  });

  it('light darkens very pale fills and uses a light background', () => {
    const preset = generateVariantPreset(project('#fafafa'), 'light');
    expect(preset.background.kind === 'solid' ? preset.background.color : undefined).toBe('#f8fafc');
    const fill = preset.layerFills.l0;
    expect(luminanceOf(fill?.kind === 'solid' ? fill.color : undefined)).toBeLessThan(luminanceOf('#fafafa'));
  });
});

describe('projectVariants', () => {
  it('returns the three seeded variants for a brand-new project', () => {
    // The real factory seeds light/dark/mono with a canvas background before
    // any edit — the slots exist independently of whether the user touched them.
    // Asserted against the real project so the seed cannot drift unnoticed.
    expect(projectVariants(createBlankProject('T', 512))).toEqual(['light', 'dark', 'mono']);
  });

  it('returns nothing when the project declares no variants at all', () => {
    expect(projectVariants(project())).toEqual([]);
    expect(projectVariants(null)).toEqual([]);
  });

  it('counts a variant edited by hand, which has no key of its own', () => {
    // UPDATE_LAYER_VARIANT writes layer overrides without creating a key.
    const p = oneLayer();
    p.layers[0].variantOverrides = { highContrast: { opacity: 0.5 } };
    expect(projectVariants(p)).toEqual(['highContrast']);
  });

  it('ignores an empty entry left behind by an older build', () => {
    // A project saved before the reducer started deleting keys still carries
    // `highContrast: {}` for a cleared variant. No content, no slot.
    const p = project();
    p.variants = { highContrast: {} };
    expect(projectVariants(p)).toEqual([]);
  });

  it('never includes default, even when a key exists for it', () => {
    const p = project();
    p.variants = { default: { canvas: { background: { kind: 'solid', color: '#ffffff' } } } };
    expect(projectVariants(p)).toEqual([]);
  });

  it('keeps registry order and does not repeat a variant', () => {
    const p = oneLayer();
    p.variants = {
      mono: { canvas: { background: { kind: 'solid', color: '#ffffff' } } },
      light: { canvas: { background: { kind: 'solid', color: '#f8fafc' } } },
      default: {}
    };
    p.layers[0].variantOverrides = { light: { opacity: 0.5 } };
    expect(projectVariants(p)).toEqual(['light', 'mono']);
  });
});
