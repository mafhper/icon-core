/**
 * Static colour library: known systems and their palettes, available to every
 * colour field.
 *
 * Deliberately **not** a Figma-style manageable library — no teams, no versions,
 * no sync. It is a curated dataset with one job: give the user recognised
 * standards to start from (Apple's system colours, Material 3 roles, the
 * Tailwind ramps) and let them browse by purpose instead of inventing a colour
 * from scratch. Values are the published ones for each system.
 */

export interface ColorPalette {
  id: string;
  name: string;
  /** What it is for — shown under the swatches. */
  purpose: string;
  colors: string[];
}

export interface ColorSystem {
  id: string;
  name: string;
  /** Where the values come from, for attribution. */
  source: string;
  palettes: ColorPalette[];
}

/** Apple system colours (iOS/macOS), light appearance. */
const APPLE: ColorSystem = {
  id: 'apple',
  name: 'Apple',
  source: 'Apple Human Interface Guidelines — system colours',
  palettes: [
    {
      id: 'apple-system',
      name: 'System',
      purpose: "Apple's system colours: recognisable and already accessible in light and dark.",
      colors: [
        '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500',
        '#FFCC00', '#34C759', '#30B0C7', '#00C7BE', '#32ADE6', '#A2845E'
      ]
    },
    {
      id: 'apple-greys',
      name: 'Greys',
      purpose: 'A neutral scale for surfaces, outlines and disabled states.',
      colors: ['#8E8E93', '#636366', '#48484A', '#3A3A3C', '#2C2C2E', '#1C1C1E', '#F2F2F7', '#E5E5EA', '#D1D1D6', '#C7C7CC']
    }
  ]
};

/** Material 3 baseline colour roles. */
const MATERIAL: ColorSystem = {
  id: 'material',
  name: 'Material 3',
  source: 'Material Design 3 — baseline colour scheme',
  palettes: [
    {
      id: 'm3-primary',
      name: 'Primary',
      purpose: "The brand colour and its container pairs: an icon's primary action.",
      colors: ['#6750A4', '#EADDFF', '#21005D', '#D0BCFF', '#4F378B', '#7F67BE']
    },
    {
      id: 'm3-secondary-tertiary',
      name: 'Secondary & Tertiary',
      purpose: 'Supporting accents, less dominant than the primary.',
      colors: ['#625B71', '#E8DEF8', '#1D192B', '#CCC2DC', '#7D5260', '#FFD8E4', '#31111D', '#EFB8C8']
    },
    {
      id: 'm3-surface',
      name: 'Surface & Outline',
      purpose: "Backgrounds, outlines and text: Material 3's neutral structure.",
      colors: ['#FFFBFE', '#E7E0EC', '#79747E', '#CAC4D0', '#1C1B1F', '#49454F', '#F5EFF7', '#DED8E1']
    },
    {
      id: 'm3-error',
      name: 'Error',
      purpose: 'Error and alert states, with a light container.',
      colors: ['#B3261E', '#F9DEDC', '#410E0B', '#F2B8B5', '#8C1D18', '#601410']
    }
  ]
};

/** Tailwind's default ramps — the most used palette family on the web. */
const TAILWIND: ColorSystem = {
  id: 'tailwind',
  name: 'Tailwind',
  source: 'Tailwind CSS — default palette',
  palettes: [
    {
      id: 'tw-blue',
      name: 'Blue → Sky',
      purpose: 'Blues: the most used family for product icons and informational state.',
      colors: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#0ea5e9']
    },
    {
      id: 'tw-violet',
      name: 'Indigo → Fuchsia',
      purpose: 'Violets and pinks: brand, emphasis and high-contrast gradients.',
      colors: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#8b5cf6', '#a855f7', '#d946ef', '#c026d3']
    },
    {
      id: 'tw-warm',
      name: 'Red → Amber',
      purpose: 'Warm tones: error, warning, energy — from red to amber.',
      colors: ['#fee2e2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#fed7aa', '#fb923c', '#f97316', '#f59e0b', '#fbbf24', '#fde68a']
    },
    {
      id: 'tw-green',
      name: 'Emerald → Teal',
      purpose: 'Greens: success, growth, confirmation.',
      colors: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#14b8a6', '#0d9488', '#2dd4bf', '#0f766e']
    },
    {
      id: 'tw-neutral',
      name: 'Slate & Gray',
      purpose: 'Neutrals: a base for metal, glass and outlines with no dominant hue.',
      colors: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#f3f4f6', '#6b7280']
    }
  ]
};

export const COLOR_LIBRARY: ColorSystem[] = [APPLE, MATERIAL, TAILWIND];

/** Flat list of palettes, each tagged with the system it belongs to. */
export const ALL_PALETTES: Array<ColorPalette & { systemId: string; systemName: string }> = COLOR_LIBRARY.flatMap(
  (system) => system.palettes.map((palette) => ({ ...palette, systemId: system.id, systemName: system.name }))
);

export const findPalette = (paletteId: string): ColorPalette | undefined =>
  ALL_PALETTES.find((palette) => palette.id === paletteId);

/** First palette of the library — the default selection in a colour field. */
export const DEFAULT_PALETTE_ID = ALL_PALETTES[0]?.id ?? '';
