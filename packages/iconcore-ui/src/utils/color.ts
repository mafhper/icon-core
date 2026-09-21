/**
 * Small colour helpers for the picker. Kept inside `@iconcore/ui` so the design
 * system stays domain-free (no `@iconcore/*` imports — G6).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export const normalizeHex = (hex: string): string => {
  const body = hex.trim().replace(/^#/, '');
  if (body.length === 3) return `#${body.split('').map((c) => c + c).join('')}`;
  if (body.length === 6) return `#${body}`;
  return '#000000';
};

export const hexToRgb = (hex: string): Rgb => {
  const body = normalizeHex(hex).slice(1);
  const int = parseInt(body, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};

export const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;

/** rgb 0..255 + alpha 0..1 → CSS. */
export const rgbToCss = ({ r, g, b }: Rgb, alpha: number): string =>
  alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`;

export const rgbToHsl = ({ r, g, b }: Rgb): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
  else h = 60 * ((rn - gn) / delta + 4);
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] :
    [c, 0, x];
  const m = ln - c / 2;
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
};

export const parseColor = (
  text: string
): { hex: string } | null => {
  const value = text.trim();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgb) return { hex: rgbToHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }) };
  const hsl = /^hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i.exec(value);
  if (hsl) return { hex: rgbToHex(hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))) };
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) return { hex: normalizeHex(value) };
  return null;
};
