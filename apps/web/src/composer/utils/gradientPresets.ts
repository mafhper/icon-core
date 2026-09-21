import type { GradientFill, GradientStop } from '@iconcore/shared';
import { findPalette } from '@iconcore/ui';
import { makeGradient, type GradientKind } from './fill';

/**
 * Gradient presets **sourced from the colour library**.
 *
 * Uniformity: instead of a hand-made colour list living next to the library, a
 * preset names a library palette and the indices it uses, so the gradient row
 * and the colour field speak the same language (and the tooltip can say where
 * the colours come from). Geometry stays kind-specific: angle for linear/angular,
 * centre and radius for radial/diamond.
 */
export interface GradientPreset {
  name: string;
  /** What it is for — shown as the chip tooltip. */
  hint: string;
  /** Library palette the colours come from. */
  paletteId: string;
  stops: GradientStop[];
  angle?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
}

interface PresetSource {
  name: string;
  hint: string;
  paletteId: string;
  /** Indices into the palette, in gradient order. */
  picks: Array<{ index: number; alpha?: number }>;
  angle?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
}

const colorAt = (paletteId: string, index: number): string =>
  findPalette(paletteId)?.colors[index] ?? '#000000';

const toPreset = (source: PresetSource): GradientPreset => {
  const last = Math.max(1, source.picks.length - 1);
  const stops: GradientStop[] = source.picks.map((pick, position) => ({
    offset: Number((position / last).toFixed(3)),
    color: colorAt(source.paletteId, pick.index),
    ...(pick.alpha !== undefined ? { alpha: pick.alpha } : {})
  }));
  return {
    name: source.name,
    hint: source.hint,
    paletteId: source.paletteId,
    stops,
    angle: source.angle,
    centerX: source.centerX,
    centerY: source.centerY,
    radius: source.radius
  };
};

const LINEAR_SOURCES: PresetSource[] = [
  {
    name: 'Metal',
    hint: 'Aço escovado — Tailwind Slate & Gray',
    paletteId: 'tw-neutral',
    angle: 90,
    picks: [{ index: 0 }, { index: 4 }, { index: 6 }, { index: 9 }]
  },
  {
    name: 'Gold',
    hint: 'Âmbar metálico — Tailwind Red → Amber',
    paletteId: 'tw-warm',
    angle: 90,
    picks: [{ index: 11 }, { index: 10 }, { index: 9 }]
  },
  {
    name: 'Duotone',
    hint: 'Duas cores, flat — Tailwind Blue',
    paletteId: 'tw-blue',
    angle: 135,
    picks: [{ index: 4 }, { index: 9 }]
  },
  {
    name: 'Gloss',
    hint: 'Brilho de vidro no topo — Material 3 surface',
    paletteId: 'm3-surface',
    angle: 90,
    picks: [{ index: 0, alpha: 0.45 }, { index: 0, alpha: 0.08 }, { index: 0, alpha: 0 }]
  },
  {
    name: 'Fade out',
    hint: 'Some na base — Material 3 surface',
    paletteId: 'm3-surface',
    angle: 90,
    picks: [{ index: 4, alpha: 0.85 }, { index: 4, alpha: 0 }]
  }
];

const RADIAL_SOURCES: PresetSource[] = [
  {
    name: 'Highlight',
    hint: 'Luz no canto superior esquerdo — Material 3 surface',
    paletteId: 'm3-surface',
    centerX: 0.32,
    centerY: 0.28,
    radius: 0.75,
    picks: [{ index: 0, alpha: 0.6 }, { index: 0, alpha: 0.12 }, { index: 0, alpha: 0 }]
  },
  {
    name: 'Spotlight',
    hint: 'Centro aceso, borda escura — Tailwind Red → Amber',
    paletteId: 'tw-warm',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.6,
    picks: [{ index: 10 }, { index: 4 }]
  },
  {
    name: 'Inner shadow',
    hint: 'Borda escura, profundidade — Material 3 surface',
    paletteId: 'm3-surface',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.7,
    picks: [{ index: 4, alpha: 0 }, { index: 4, alpha: 0.05 }, { index: 4, alpha: 0.45 }]
  },
  {
    name: 'Glow',
    hint: 'Núcleo luminoso — Tailwind Blue → Sky',
    paletteId: 'tw-blue',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.55,
    picks: [{ index: 3 }, { index: 10 }, { index: 8 }]
  }
];

const ANGULAR_SOURCES: PresetSource[] = [
  {
    name: 'Chrome ring',
    hint: 'Bandas metálicas — Tailwind Slate & Gray',
    paletteId: 'tw-neutral',
    angle: 0,
    picks: [{ index: 0 }, { index: 5 }, { index: 1 }, { index: 7 }, { index: 0 }]
  },
  {
    name: 'Cone light',
    hint: 'Feixe girando — Material 3 surface',
    paletteId: 'm3-surface',
    angle: 0,
    picks: [{ index: 0, alpha: 0.5 }, { index: 0, alpha: 0 }, { index: 0, alpha: 0 }, { index: 0, alpha: 0.5 }]
  },
  {
    name: 'Rim light',
    hint: 'Luz de contorno — Material 3 surface',
    paletteId: 'm3-surface',
    angle: 0,
    picks: [
      { index: 4, alpha: 0.35 },
      { index: 4, alpha: 0 },
      { index: 0, alpha: 0.55 },
      { index: 4, alpha: 0 },
      { index: 4, alpha: 0.35 }
    ]
  },
  {
    name: 'Pinwheel',
    hint: 'Matizes girando — Tailwind Indigo → Fuchsia',
    paletteId: 'tw-violet',
    angle: 0,
    picks: [{ index: 4 }, { index: 7 }, { index: 9 }, { index: 10 }, { index: 4 }]
  }
];

const DIAMOND_SOURCES: PresetSource[] = [
  {
    name: 'Gem',
    hint: 'Faceta central clara — Tailwind Blue',
    paletteId: 'tw-blue',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.75,
    picks: [{ index: 3 }, { index: 10 }, { index: 8 }]
  },
  {
    name: 'Facet',
    hint: 'Faceta diagonal — Tailwind Slate & Gray',
    paletteId: 'tw-neutral',
    centerX: 0.35,
    centerY: 0.35,
    radius: 0.9,
    picks: [{ index: 0 }, { index: 5 }]
  },
  {
    name: 'Bevel',
    hint: 'Chanfro nas bordas — Material 3 surface',
    paletteId: 'm3-surface',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.65,
    picks: [{ index: 0, alpha: 0.45 }, { index: 0, alpha: 0.05 }, { index: 4, alpha: 0.3 }]
  },
  {
    name: 'Emerald',
    hint: 'Verde joia — Tailwind Emerald → Teal',
    paletteId: 'tw-green',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.7,
    picks: [{ index: 1 }, { index: 6 }]
  }
];

export const GRADIENT_PRESETS: Record<GradientKind, GradientPreset[]> = {
  'linear-gradient': LINEAR_SOURCES.map(toPreset),
  'radial-gradient': RADIAL_SOURCES.map(toPreset),
  'angular-gradient': ANGULAR_SOURCES.map(toPreset),
  'diamond-gradient': DIAMOND_SOURCES.map(toPreset)
};

/** Presets available for the kind of the given fill. */
export const presetsFor = (fill: GradientFill): GradientPreset[] => GRADIENT_PRESETS[fill.kind] ?? [];

/**
 * Apply a preset while keeping the fill's kind: stops always come from the
 * preset, geometry only from the axes the kind actually uses.
 */
export const applyGradientPreset = (fill: GradientFill, preset: GradientPreset): GradientFill =>
  makeGradient(
    fill.kind,
    preset.stops.map((stop) => ({ ...stop })),
    {
      angle: preset.angle,
      centerX: preset.centerX,
      centerY: preset.centerY,
      radius: preset.radius
    }
  );
