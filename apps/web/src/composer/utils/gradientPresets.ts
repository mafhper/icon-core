import type { GradientFill, GradientStop } from '@iconcore/shared';
import { makeGradient, type GradientKind } from './fill';

/**
 * Icon-oriented gradient presets, one set per gradient kind.
 *
 * The previous list was generic web gradients (Sunset, Neon, Violet…). An icon
 * needs the opposite: a light source, a material or a facet. Each preset carries
 * the geometry its kind actually uses (angle for linear/angular, centre and
 * radius for radial/diamond) so applying it produces the intended effect rather
 * than just recolouring the stops.
 */
export interface GradientPreset {
  name: string;
  /** What it is for — shown as the chip tooltip. */
  hint: string;
  stops: GradientStop[];
  /** Degrees (linear/angular). */
  angle?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
}

const LINEAR: GradientPreset[] = [
  {
    name: 'Metal',
    hint: 'Aço escovado: brilho no topo, sombra na base',
    angle: 90,
    stops: [
      { offset: 0, color: '#f8fafc' },
      { offset: 0.45, color: '#94a3b8' },
      { offset: 0.55, color: '#64748b' },
      { offset: 1, color: '#334155' }
    ]
  },
  {
    name: 'Gold',
    hint: 'Dourado com reflexo central',
    angle: 90,
    stops: [
      { offset: 0, color: '#fde68a' },
      { offset: 0.5, color: '#d4a24a' },
      { offset: 1, color: '#8a5a1e' }
    ]
  },
  {
    name: 'Duotone',
    hint: 'Duas cores sem brilho — base para ícones flat',
    angle: 135,
    stops: [
      { offset: 0, color: '#60a5fa' },
      { offset: 1, color: '#1e3a8a' }
    ]
  },
  {
    name: 'Gloss',
    hint: 'Brilho de vidro no topo',
    angle: 90,
    stops: [
      { offset: 0, color: '#ffffff', alpha: 0.45 },
      { offset: 0.5, color: '#ffffff', alpha: 0.08 },
      { offset: 1, color: '#ffffff', alpha: 0 }
    ]
  },
  {
    name: 'Fade out',
    hint: 'Some na base — reflexos e sombras',
    angle: 90,
    stops: [
      { offset: 0, color: '#0f172a', alpha: 0.85 },
      { offset: 1, color: '#0f172a', alpha: 0 }
    ]
  }
];

const RADIAL: GradientPreset[] = [
  {
    name: 'Highlight',
    hint: 'Luz no canto superior esquerdo',
    centerX: 0.32,
    centerY: 0.28,
    radius: 0.75,
    stops: [
      { offset: 0, color: '#ffffff', alpha: 0.6 },
      { offset: 0.55, color: '#ffffff', alpha: 0.12 },
      { offset: 1, color: '#ffffff', alpha: 0 }
    ]
  },
  {
    name: 'Spotlight',
    hint: 'Centro aceso, borda escura',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.6,
    stops: [
      { offset: 0, color: '#fde68a' },
      { offset: 1, color: '#b45309' }
    ]
  },
  {
    name: 'Inner shadow',
    hint: 'Borda escura: profundidade',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.7,
    stops: [
      { offset: 0, color: '#0f172a', alpha: 0 },
      { offset: 0.7, color: '#0f172a', alpha: 0.05 },
      { offset: 1, color: '#0f172a', alpha: 0.45 }
    ]
  },
  {
    name: 'Glow',
    hint: 'Núcleo luminoso',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.55,
    stops: [
      { offset: 0, color: '#a5f3fc' },
      { offset: 0.6, color: '#22d3ee' },
      { offset: 1, color: '#0e7490' }
    ]
  }
];

const ANGULAR: GradientPreset[] = [
  {
    name: 'Chrome ring',
    hint: 'Anel metálico: bandas claras e escuras',
    angle: 0,
    stops: [
      { offset: 0, color: '#f8fafc' },
      { offset: 0.25, color: '#64748b' },
      { offset: 0.5, color: '#e2e8f0' },
      { offset: 0.75, color: '#334155' },
      { offset: 1, color: '#f8fafc' }
    ]
  },
  {
    name: 'Cone light',
    hint: 'Feixe de luz girando',
    angle: 0,
    stops: [
      { offset: 0, color: '#ffffff', alpha: 0.5 },
      { offset: 0.35, color: '#ffffff', alpha: 0 },
      { offset: 0.65, color: '#ffffff', alpha: 0 },
      { offset: 1, color: '#ffffff', alpha: 0.5 }
    ]
  },
  {
    name: 'Rim light',
    hint: 'Luz de contorno em um lado',
    angle: 0,
    stops: [
      { offset: 0, color: '#0f172a', alpha: 0.35 },
      { offset: 0.2, color: '#0f172a', alpha: 0 },
      { offset: 0.5, color: '#ffffff', alpha: 0.55 },
      { offset: 0.8, color: '#0f172a', alpha: 0 },
      { offset: 1, color: '#0f172a', alpha: 0.35 }
    ]
  },
  {
    name: 'Pinwheel',
    hint: 'Quatro matizes — ícones lúdicos',
    angle: 0,
    stops: [
      { offset: 0, color: '#60a5fa' },
      { offset: 0.25, color: '#a78bfa' },
      { offset: 0.5, color: '#f472b6' },
      { offset: 0.75, color: '#fbbf24' },
      { offset: 1, color: '#60a5fa' }
    ]
  }
];

const DIAMOND: GradientPreset[] = [
  {
    name: 'Gem',
    hint: 'Faceta central clara',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.75,
    stops: [
      { offset: 0, color: '#a5f3fc' },
      { offset: 0.5, color: '#0891b2' },
      { offset: 1, color: '#164e63' }
    ]
  },
  {
    name: 'Facet',
    hint: 'Faceta diagonal: canto claro → canto escuro',
    centerX: 0.35,
    centerY: 0.35,
    radius: 0.9,
    stops: [
      { offset: 0, color: '#f8fafc' },
      { offset: 1, color: '#64748b' }
    ]
  },
  {
    name: 'Bevel',
    hint: 'Chanfro suave nas bordas',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.65,
    stops: [
      { offset: 0, color: '#ffffff', alpha: 0.45 },
      { offset: 0.6, color: '#ffffff', alpha: 0.05 },
      { offset: 1, color: '#0f172a', alpha: 0.3 }
    ]
  },
  {
    name: 'Emerald',
    hint: 'Verde joia',
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.7,
    stops: [
      { offset: 0, color: '#a7f3d0' },
      { offset: 1, color: '#047857' }
    ]
  }
];

export const GRADIENT_PRESETS: Record<GradientKind, GradientPreset[]> = {
  'linear-gradient': LINEAR,
  'radial-gradient': RADIAL,
  'angular-gradient': ANGULAR,
  'diamond-gradient': DIAMOND
};

/** Presets available for the kind of the given fill. */
export const presetsFor = (fill: GradientFill): GradientPreset[] => GRADIENT_PRESETS[fill.kind] ?? LINEAR;

/**
 * Apply a preset while keeping the fill's kind: stops always come from the
 * preset, geometry only from the axes the kind actually uses (so switching a
 * radial preset never writes a meaningless angle).
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
