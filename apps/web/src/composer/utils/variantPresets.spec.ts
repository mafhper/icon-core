import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { generateVariantPreset, isGeneratableVariant } from './variantPresets';
import { hexToRgb, relativeLuminance } from './color';

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
  schemaVersion: 2,
  metadata: { name: 'T', shortName: 'T' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: colors.map((c, i) => layer(`l${i}`, c)),
  variants: {},
  targets: [],
  exportProfile: { outputBaseName: 't', quality: 0.95, generateReport: true }
});

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
    expect(preset.background.color).toBe('#0f172a');
    const fill = preset.layerFills.l0;
    expect(luminanceOf(fill?.kind === 'solid' ? fill.color : undefined)).toBeGreaterThan(luminanceOf('#111111'));
  });

  it('light darkens very pale fills and uses a light background', () => {
    const preset = generateVariantPreset(project('#fafafa'), 'light');
    expect(preset.background.color).toBe('#f8fafc');
    const fill = preset.layerFills.l0;
    expect(luminanceOf(fill?.kind === 'solid' ? fill.color : undefined)).toBeLessThan(luminanceOf('#fafafa'));
  });
});
