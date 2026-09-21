/**
 * Colour maths shared by the raster and SVG renderers.
 *
 * Interpolation happens in **Oklab** (perceptually uniform, what Figma/modern
 * CSS use) while output stays 8-bit sRGB. Alpha is a separate 0..1 channel so
 * `#RRGGBB` inputs keep working unchanged.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse `#rgb` / `#rrggbb` (with or without `#`). Returns null for anything else. */
export const parseHex = (hex: string): Rgb | null => {
  const match = HEX.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) body = body.split('').map((c) => c + c).join('');
  const int = parseInt(body, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};

const channel = (value: number): string =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

export const rgbToHex = ({ r, g, b }: Rgb): string => `#${channel(r)}${channel(g)}${channel(b)}`;

/** CSS colour for a solid paint, honouring alpha. Non-hex input passes through. */
export const toRgba = (color: string | undefined, alpha = 1): string => {
  const rgb = parseHex(color ?? '#000000');
  if (!rgb) return color ?? 'transparent';
  const a = clamp01(alpha);
  if (a >= 1) return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(a.toFixed(4))})`;
};

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export const toOklab = ({ r, g, b }: Rgb): Oklab => {
  const R = srgbToLinear(r / 255);
  const G = srgbToLinear(g / 255);
  const B = srgbToLinear(b / 255);

  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
};

export const fromOklab = ({ L, a, b }: Oklab): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: Math.round(clamp01(linearToSrgb(R)) * 255),
    g: Math.round(clamp01(linearToSrgb(G)) * 255),
    b: Math.round(clamp01(linearToSrgb(B)) * 255)
  };
};

/** Parse `rgb()`/`rgba()`/`hsl()` sample output without regex (ReDoS-safe). */
export const parseRgba = (text: string): { r: number; g: number; b: number; a: number } | null => {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open === -1 || close === -1 || close < open) return null;
  const value = text.slice(open + 1, close).trim();
  const parts = value.split(',');
  if (parts.length < 3) return null;
  const [r, g, b] = parts.map((part) => Number(part.trim().replace('%', '')));
  const a = parts.length >= 4 ? Number(parts[3].trim().replace('%', '')) : 1;
  if (![r, g, b, a].every((n) => Number.isFinite(n))) return null;
  return { r, g, b, a };
};

/** Interpolate two sRGB colours in Oklab. */
export const mixOklab = (from: Rgb, to: Rgb, t: number): Rgb => {
  const k = clamp01(t);
  const A = toOklab(from);
  const B = toOklab(to);
  return fromOklab({
    L: A.L + (B.L - A.L) * k,
    a: A.a + (B.a - A.a) * k,
    b: A.b + (B.b - A.b) * k
  });
};
