import type { Fill } from '@iconcore/shared';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const hexToRgb = (hex: string): Rgb | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};

const channel = (value: number): string =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

export const rgbToHex = ({ r, g, b }: Rgb): string => `#${channel(r)}${channel(g)}${channel(b)}`;

/** WCAG relative luminance (0 = black, 1 = white). */
export const relativeLuminance = ({ r, g, b }: Rgb): number => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t
});

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Blend a hex color toward white by `amount` (0..1). Non-hex inputs pass through. */
export const lighten = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mix(rgb, WHITE, amount)) : hex;
};

/** Blend a hex color toward black by `amount` (0..1). Non-hex inputs pass through. */
export const darken = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mix(rgb, BLACK, amount)) : hex;
};

/** Perceptual grayscale of a hex color (preserves relative lightness). */
export const toGray = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const v = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  return rgbToHex({ r: v, g: v, b: v });
};

/** Apply a per-color transform to a Fill (solid color or every gradient stop). */
export const mapFillColors = (fill: Fill | undefined, fn: (hex: string) => string): Fill | undefined => {
  if (!fill) return fill;
  if (fill.kind === 'solid') {
    return fill.color ? { ...fill, color: fn(fill.color) } : fill;
  }
  return { ...fill, stops: (fill.stops ?? []).map((stop) => ({ ...stop, color: fn(stop.color) })) };
};
