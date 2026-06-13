import type { Fill, IconCoreProject, IconVariant } from '@iconcore/shared';
import { darken, hexToRgb, lighten, mapFillColors, relativeLuminance, toGray } from './color';

/** Variants the editor can auto-generate (excludes 'default' and unused schema variants). */
export type GeneratableVariant = 'light' | 'dark' | 'mono';

export const GENERATABLE_VARIANTS: GeneratableVariant[] = ['light', 'dark', 'mono'];

export const isGeneratableVariant = (variant: IconVariant): variant is GeneratableVariant =>
  variant === 'light' || variant === 'dark' || variant === 'mono';

const VARIANT_BACKGROUND: Record<GeneratableVariant, string> = {
  light: '#f8fafc',
  dark: '#0f172a',
  mono: '#ffffff'
};

/**
 * Auto color transform per variant, derived from the default layer colors:
 * - light: darken colors that are too pale to read on a light surface
 * - dark:  lighten colors that are too dark to read on a dark surface
 * - mono:  convert every color to perceptual grayscale
 */
const transformFill = (fill: Fill | undefined, variant: GeneratableVariant): Fill | undefined => {
  if (variant === 'mono') return mapFillColors(fill, toGray);

  if (variant === 'dark') {
    return mapFillColors(fill, (hex) => {
      const rgb = hexToRgb(hex);
      return rgb && relativeLuminance(rgb) < 0.35 ? lighten(hex, 0.5) : hex;
    });
  }

  return mapFillColors(fill, (hex) => {
    const rgb = hexToRgb(hex);
    return rgb && relativeLuminance(rgb) > 0.75 ? darken(hex, 0.35) : hex;
  });
};

export interface VariantPreset {
  background: Fill;
  /** Per layer id → computed fill for this variant. */
  layerFills: Record<string, Fill | undefined>;
}

/** Compute a starting-point preset for a variant from the project's default layers. */
export const generateVariantPreset = (project: IconCoreProject, variant: GeneratableVariant): VariantPreset => {
  const layerFills: Record<string, Fill | undefined> = {};
  for (const layer of project.layers) {
    layerFills[layer.id] = transformFill(layer.fill, variant);
  }
  return {
    background: { kind: 'solid', color: VARIANT_BACKGROUND[variant] },
    layerFills
  };
};
