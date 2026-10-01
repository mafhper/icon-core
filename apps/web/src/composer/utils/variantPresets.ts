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

/**
 * The variants a project has a slot for, in the order they should be offered.
 *
 * Two independent facts feed this, and conflating them is the bug this fixes:
 *
 * 1. **A slot exists** when `project.variants` has a key for it. A new project
 *    seeds `light`, `dark` and `mono` (see `projectFactory`), so three slots
 *    exist before the user edits anything.
 * 2. **A variant was edited** when some layer carries a `variantOverrides`
 *    entry. `UPDATE_LAYER_VARIANT` writes layer overrides *without* creating a
 *    key, so a project edited by hand can name a variant that no key mentions.
 *
 * `default` is excluded: it is the implicit base, never a slot.
 *
 * A project written by an older build may also carry an empty entry for a
 * variant that was cleared. An entry with no canvas override and no layer
 * override is a leftover, not a slot, so it is filtered out.
 */
export const projectVariants = (project: IconCoreProject | null | undefined): IconVariant[] => {
  if (!project) return [];

  const edited = new Set<IconVariant>();
  for (const layer of project.layers) {
    for (const variant of Object.keys(layer.variantOverrides ?? {}) as IconVariant[]) {
      if (variant !== 'default') edited.add(variant);
    }
  }

  const seen = new Set<IconVariant>();
  const ordered: IconVariant[] = [];
  /** A variant counts when it is declared with content or was edited by hand. */
  const counts = (variant: IconVariant): boolean =>
    variant !== 'default' && (Boolean(project.variants[variant]?.canvas) || edited.has(variant));
  const offer = (variant: IconVariant) => {
    if (!counts(variant) || seen.has(variant)) return;
    seen.add(variant);
    ordered.push(variant);
  };

  // Registry order first, so the usual set reads light → dark → mono.
  for (const variant of GENERATABLE_VARIANTS) offer(variant);

  // Then anything the project named that the registry does not know (a variant
  // edited by hand, or one from a future schema).
  for (const variant of Object.keys(project.variants) as IconVariant[]) offer(variant);
  for (const variant of edited) offer(variant);

  return ordered;
};

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
