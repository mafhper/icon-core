// Icon appearance data: artwork palettes, shader presets and mask geometry.
// Artwork colors live here (not in CSS tokens) because they describe the icon itself.

export type Appearance = 'default' | 'light' | 'dark' | 'mono';

export const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Mono' },
];

/**
 * Page theme for an appearance. "default" follows the OS; every explicit appearance
 * overrides it (mono renders its own greyscale tokens, so it is a light page too).
 */
export function resolveDarkTheme(appearance: Appearance, systemDark: boolean): boolean {
  return appearance === 'dark' || (appearance === 'default' && systemDark);
}

export const CANVAS_PX = 512;

/** Frame radius is stored as % of the icon size: 0 is a square, 50 a circle. */
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 50;

/** Frame radius in canvas px, clamped to the scale. */
export function radiusToPx(pct: number, size = CANVAS_PX) {
  return Math.round((Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, pct)) / 100) * size);
}

/**
 * Where a radius sits on its rail, from 0 at the square end to 1 at the circle.
 *
 * A rail's thumb travels half a thumb-width inside its own box, so a mark drawn at
 * `left: fraction * 100%` inside a layer inset by half a thumb lands under the thumb when the
 * slider holds that radius. That is the contract the preset marks are placed by — one derivation
 * for every preset, instead of a percentage written down twice.
 */
export function radiusFraction(pct: number) {
  const clamped = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, pct));

  return (clamped - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);
}

export const RADIUS_PRESETS = [
  { id: 'square', label: 'Quadrado', value: 0 },
  { id: 'rounded', label: 'Retângulo arredondado (24 px)', value: (24 / CANVAS_PX) * 100 },
  { id: 'squircle', label: 'Squircle', value: 22.5 },
  { id: 'circle', label: 'Círculo', value: 50 },
] as const;

export const DEFAULT_RADIUS = (130 / CANVAS_PX) * 100;

/**
 * Radius of a **thumb**: the plate under a preview of the icon, fixed at 12 % of its own box.
 *
 * A preview is not a miniature of the file. The 512 px icon carries 130 px of corner (25.39 %), and
 * at 22–38 px that same share leaves so little straight edge that the plate reads as a blob — and
 * in the dock, where the tile is only a few pixels wider than the glyph, its 9.65 px corner sits
 * almost on the tile's own. The landing mockup draws every small preview at a fixed `radii={20}`
 * instead (`mockup-lovable-shader/main/src/components/icon-core/EditorShowcase.tsx`, the 22 px
 * layer thumbs), independent of the `radii={radius}` its 260 px canvas uses.
 *
 * Written once here so both thumb surfaces — the appearance dock and the editor's layer rows —
 * read the same number: 12 % of 38 px is 4.56 px, of 34 px 4.08 px, of 22 px 2.64 px. The port
 * first copied the mockup's 20 and the owner read the plate as still too curved, so the number is
 * 12: the mockup is where the idea came from, not the value that binds it.
 */
export const THUMB_RADIUS = 12;

/* ---------- Geometry (viewBox 0 0 512 512) ---------- */

// Original logo paths (from banner.svg), drawn in a 256 px box at (297, 87).
// Wrap them in <g transform={LOGO_TRANSFORM}> to place them in the 512 viewBox.
export const LOGO_TRANSFORM = 'scale(2) translate(-297 -87)';

const f = (n: number) => n.toFixed(1);

export type Petal = { d: string; grad: [number, number, number, number] };

export const PETALS: Petal[] = [
  {
    d: 'M507.807 141.247C508.404 141.663 508.773 142.309 508.87 143.03L516.341 198.731C516.507 199.957 515.099 200.8 514.101 200.07C505.509 193.78 477.733 174.642 451.206 169.381C423.104 163.807 353.098 178.584 358.571 174.875C364.044 171.165 421.344 127.988 454.066 126.5C482.898 125.188 503.352 138.147 507.807 141.247Z',
    grad: [516.18, 141.456, 383.114, 218.282],
  },
  {
    d: 'M409.091 107.633C409.711 107.403 410.374 107.439 410.983 107.696L459.256 128.064C460.389 128.542 460.407 130.171 459.281 130.668C449.581 134.943 419.062 149.44 401.218 169.809C382.341 191.359 360.134 259.375 359.658 252.781C359.182 246.186 350.44 174.974 365.512 145.891C378.981 119.903 403.933 109.544 409.091 107.633Z',
    grad: [409.521, 99.5781, 409.521, 253.229],
  },
  {
    d: 'M345.17 287.966C344.573 287.551 344.204 286.904 344.108 286.183L336.636 230.482C336.472 229.256 337.879 228.413 338.877 229.144C347.469 235.432 375.245 254.571 401.772 259.831C429.874 265.406 499.88 250.629 494.407 254.338C488.933 258.047 431.634 301.225 398.911 302.714C370.079 304.025 349.626 291.066 345.17 287.966Z',
    grad: [336.798, 287.756, 469.864, 210.931],
  },
  {
    d: 'M524.391 258.923C524.256 259.611 523.845 260.189 523.261 260.576L482.114 287.874C481.116 288.537 479.779 287.706 479.928 286.516C481.212 276.233 484.508 242.325 476.114 216.394C467.288 189.138 420.275 135.202 426.181 138.175C432.088 141.147 497.711 170.149 514.954 198C530.414 222.971 525.56 252.984 524.391 258.923Z',
    grad: [532.156, 259.528, 400.234, 180.757],
  },
  {
    d: 'M444.688 322.367C444.069 322.598 443.406 322.562 442.797 322.304L394.524 301.935C393.391 301.458 393.373 299.829 394.498 299.333C404.199 295.057 434.718 280.561 452.561 260.191C471.439 238.64 493.645 170.624 494.122 177.219C494.597 183.814 503.341 255.026 488.267 284.109C474.798 310.097 449.847 320.456 444.688 322.367Z',
    grad: [444.259, 330.42, 444.259, 176.771],
  },
  {
    d: 'M325.274 172.934C325.399 172.247 325.799 171.665 326.375 171.269L367.117 143.265C368.106 142.586 369.457 143.396 369.326 144.588C368.192 154.899 365.397 188.841 374.171 214.64C383.395 241.764 431.195 295.003 425.246 292.118C419.297 289.233 353.254 261.198 335.604 233.603C319.778 208.861 324.192 178.871 325.274 172.934Z',
    grad: [317.5, 172.334, 450.566, 249.16],
  },
];

// The "I" core: tall block with big rounded top-left and bottom-right corners.
export const CORE_PATH =
  'M392.395 193.177C392.395 170.59 410.705 152.28 433.292 152.28H453.5C455.759 152.28 457.59 154.111 457.59 156.37V236.759C457.59 259.346 439.28 277.656 416.693 277.656H396.484C394.226 277.656 392.395 275.825 392.395 273.566V193.177Z';

export type Radii = number | [number, number, number, number];

/** Rounded rect path with per-corner radii in % of size (tl, tr, br, bl). */
export function roundedRectPath(size: number, radii: Radii) {
  const arr: [number, number, number, number] =
    typeof radii === 'number' ? [radii, radii, radii, radii] : radii;
  const px = (r: number) => (Math.min(50, Math.max(0, r)) / 100) * size;
  const [tl, tr, br, bl] = [px(arr[0]), px(arr[1]), px(arr[2]), px(arr[3])];
  const s = size;
  return [
    `M${f(tl)} 0`,
    `L${f(s - tr)} 0`,
    tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${s} ${f(tr)}` : '',
    `L${s} ${f(s - br)}`,
    br ? `A${f(br)} ${f(br)} 0 0 1 ${f(s - br)} ${s}` : '',
    `L${f(bl)} ${s}`,
    bl ? `A${f(bl)} ${f(bl)} 0 0 1 0 ${f(s - bl)}` : '',
    `L0 ${f(tl)}`,
    tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(tl)} 0` : '',
    'Z',
  ].join(' ');
}

/* ---------- Artwork palettes ---------- */

export type IconPalette = {
  tile: { kind: 'radial' | 'linear'; stops: [number, string][] };
  /** Petal gradient: bright tip fading out toward the center, as in the original logo. */
  petal: { from: string; fromOpacity: number; to: string; toOpacity: number };
  /** Core color cycle: base, then two tones it pulses through. */
  core: [string, string, string];
  highlight: number;
};

export const ICON_PALETTES: Record<Appearance, IconPalette> = {
  default: {
    tile: { kind: 'radial', stops: [[0, '#f4f5f5'], [0.55, '#dcdedf'], [1, '#b9bcbe']] },
    petal: { from: '#7f8386', fromOpacity: 0.9, to: '#a7aaac', toOpacity: 0.05 },
    core: ['#00d6ff', '#5ef5dc', '#3a9bff'],
    highlight: 0.35,
  },
  light: {
    tile: { kind: 'linear', stops: [[0, '#e4f46a'], [0.5, '#b9ec8c'], [1, '#6fdde3']] },
    petal: { from: '#ffffff', fromOpacity: 0.95, to: '#ffffff', toOpacity: 0.05 },
    core: ['#00d6ff', '#4ff0c8', '#2f8cff'],
    highlight: 0.4,
  },
  dark: {
    tile: { kind: 'radial', stops: [[0, '#34353a'], [0.6, '#28282a'], [1, '#151517']] },
    petal: { from: '#d9d9d9', fromOpacity: 1, to: '#737373', toOpacity: 0 },
    core: ['#00d6ff', '#6bffe4', '#4a7dff'],
    highlight: 0.18,
  },
  mono: {
    tile: { kind: 'radial', stops: [[0, '#ffffff'], [0.6, '#f0f0f0'], [1, '#dadada']] },
    petal: { from: '#8c8c8c', fromOpacity: 0.9, to: '#c4c4c4', toOpacity: 0.05 },
    core: ['#8f8f8f', '#c9c9c9', '#5e5e5e'],
    highlight: 0.3,
  },
};

/* ---------- Shader presets ---------- */

export type Vec3 = [number, number, number];
export type ShaderPreset = {
  base: Vec3;
  c1: Vec3;
  c2: Vec3;
  c3: Vec3;
  iri: number;
  light: number;
  grain: number;
  scale: number;
  sat: number;
  vig: number;
  /** Clock multiplier of the field's drift. 1 is the reference pace; 0 would freeze it. */
  flow: number;
  /** Domain-warp strength: how far the noise folds over itself, which is what reads as depth. */
  warp: number;
  /** Amplitude of the slow second sheet that gives the field structure instead of a flat wash. */
  detail: number;
};

function hex(h: string): Vec3 {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Page presets are the atmosphere behind the hero, and each appearance carries its own field:
// the palette says what it is, `flow` / `warp` / `detail` say how it moves and how deep it reads.
// Light is quick and airy, dark drifts slowly over a heavier warp, mono is nearly still. "default"
// only splits by page theme, because it follows the OS -- same motion, two palettes.
//
// Default follows the silver tile: steel greys with cyan + mint chroma, in both page themes.
// Dark is near-black with a deep, quiet teal, so the two never read as the same scene.
export const PAGE_PRESETS = {
  defaultLight: {
    base: hex('#e9edf0'),
    c1: hex('#cfd6db'),
    c2: hex('#8fe3f2'),
    c3: hex('#aeead2'),
    iri: 0.7,
    light: 0.8,
    grain: 0.012,
    scale: 1.25,
    sat: 1,
    vig: 0.5,
    flow: 1,
    warp: 1,
    detail: 0.35,
  },
  defaultDark: {
    base: hex('#1b2024'),
    c1: hex('#363e45'),
    c2: hex('#1aa3c0'),
    c3: hex('#3bb88f'),
    iri: 0.8,
    light: 0.9,
    grain: 0.012,
    scale: 1.25,
    sat: 1,
    vig: 0.6,
    flow: 1,
    warp: 1,
    detail: 0.35,
  },
  light: {
    base: hex('#f4f7ee'),
    c1: hex('#e8f4cc'),
    c2: hex('#a3eef0'),
    c3: hex('#d6f59a'),
    iri: 0.5,
    light: 0.85,
    grain: 0.012,
    scale: 1.4,
    sat: 1,
    vig: 0.4,
    flow: 1.55,
    warp: 0.85,
    detail: 0.6,
  },
  dark: {
    base: hex('#040506'),
    c1: hex('#0b1013'),
    c2: hex('#03465a'),
    c3: hex('#082a25'),
    iri: 0.5,
    light: 1,
    grain: 0.012,
    scale: 1.6,
    sat: 1,
    vig: 1.15,
    flow: 0.55,
    warp: 1.4,
    detail: 0.45,
  },
  mono: {
    base: hex('#ececec'),
    c1: hex('#dbdbdb'),
    c2: hex('#c2c2c2'),
    c3: hex('#f8f8f8'),
    iri: 0,
    light: 0.7,
    grain: 0.012,
    scale: 1.4,
    sat: 0,
    vig: 0.5,
    flow: 0.22,
    warp: 0.55,
    detail: 0.15,
  },
} satisfies Record<string, ShaderPreset>;

/**
 * The tile behind the icon artwork. It paints the icon, not the page, so it keeps the reference
 * field (flow 1, warp 1, no detail sheet): the appearance changes its colors, and the richer
 * motion belongs to the page backdrop only.
 */
export const TILE_PRESETS: Record<Appearance, ShaderPreset> = {
  default: {
    base: hex('#c3c6c8'),
    c1: hex('#e6e8e9'),
    c2: hex('#f8f9f9'),
    c3: hex('#b6babc'),
    iri: 0.3,
    light: 1.1,
    grain: 0.008,
    scale: 1.1,
    sat: 1,
    vig: 1.5,
    flow: 1,
    warp: 1,
    detail: 0,
  },
  light: {
    base: hex('#a9e47a'),
    c1: hex('#dcf26c'),
    c2: hex('#79e0e2'),
    c3: hex('#c6f3a4'),
    iri: 0.4,
    light: 1,
    grain: 0.008,
    scale: 1.1,
    sat: 1,
    vig: 0.8,
    flow: 1,
    warp: 1,
    detail: 0,
  },
  dark: {
    base: hex('#151517'),
    c1: hex('#28282a'),
    c2: hex('#3a3b40'),
    c3: hex('#0b3440'),
    iri: 0.55,
    light: 0.9,
    grain: 0.008,
    scale: 1.1,
    sat: 1,
    vig: 1.6,
    flow: 1,
    warp: 1,
    detail: 0,
  },
  mono: {
    base: hex('#dedede'),
    c1: hex('#f2f2f2'),
    c2: hex('#ffffff'),
    c3: hex('#d0d0d0'),
    iri: 0,
    light: 1,
    grain: 0.008,
    scale: 1.1,
    sat: 0,
    vig: 1.2,
    flow: 1,
    warp: 1,
    detail: 0,
  },
};

export function pagePresetFor(appearance: Appearance, dark: boolean): ShaderPreset {
  if (appearance === 'default') return dark ? PAGE_PRESETS.defaultDark : PAGE_PRESETS.defaultLight;
  return PAGE_PRESETS[appearance];
}
