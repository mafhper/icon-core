/**
 * IC77 — HSV math for the studio colour picker (Passo 3).
 *
 * Kept local and pure: the picker's 2D area and hue slider speak HSV, the
 * document speaks hex. `normalizeHex` accepts `#rgb`/`#rrggbb` with or without
 * the hash; `null` means "not a colour" and callers decide what to do.
 *
 * F4 adds the RGB and HSL dialects the format fields need. RGB is 0–255
 * integers, HSL is h 0–360 with s/l 0–100: the shapes the fields parse and
 * print, so the picker never invents a second dialect.
 */
export interface Hsv {
  /** 0–360, 0 = red. */
  h: number;
  /** 0–1. */
  s: number;
  /** 0–1. */
  v: number;
}

export interface Rgb {
  /** 0–255 integers. */
  r: number;
  /** 0–255 integers. */
  g: number;
  /** 0–255 integers. */
  b: number;
}

export interface Hsl {
  /** 0–360. */
  h: number;
  /** 0–100. */
  s: number;
  /** 0–100. */
  l: number;
}

export const normalizeHex = (input: string): string | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const value = match[1].toLowerCase();
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return `#${full}`;
};

export const hexToHsv = (hex: string): Hsv | null => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : delta / max, v: max };
};

export const hsvToHex = ({ h, s, v }: Hsv): string => {
  const { r, g, b } = hsvToRgb({ h, s, v });
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

/** HSV (h 0–360, s/v 0–1) to RGB 0–255. The single conversion `hsvToHex` stands on. */
export const hsvToRgb = ({ h, s, v }: Hsv): Rgb => {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const [r1, g1, b1] =
    hue < 1 ? [c, x, 0]
    : hue < 2 ? [x, c, 0]
    : hue < 3 ? [0, c, x]
    : hue < 4 ? [0, x, c]
    : hue < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = v - c;
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round((value + m) * 255)));
  return { r: channel(r1), g: channel(g1), b: channel(b1) };
};

/** RGB 0–255 to HSV. Inverse of `hsvToRgb` (within rounding). */
export const rgbToHsv = ({ r, g, b }: Rgb): Hsv => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : delta / max, v: max };
};

/** `#rrggbb` to RGB. `null` when the hex is not a colour. */
export const hexToRgb = (hex: string): Rgb | null => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
};

/** RGB 0–255 to `#rrggbb`. */
export const rgbToHex = ({ r, g, b }: Rgb): string => {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

/** RGB 0–255 to HSL (h 0–360, s/l 0–100). */
export const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

/** HSL (h 0–360, s/l 0–100) to RGB 0–255. */
export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const [r1, g1, b1] =
    hue < 1 ? [c, x, 0]
    : hue < 2 ? [x, c, 0]
    : hue < 3 ? [0, c, x]
    : hue < 4 ? [0, x, c]
    : hue < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = ln - c / 2;
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round((value + m) * 255)));
  return { r: channel(r1), g: channel(g1), b: channel(b1) };
};

export type PickerFormat = 'hex' | 'rgb' | 'hsl' | 'hsb';

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const parseTriple = (text: string): number[] | null => {
  const parts = text
    .replace(/[a-z()%]/gi, '')
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts;
};

/**
 * Print a colour in the picker's field format. HSB is hue 0–360 plus s/b
 * 0–100 (the OpenPencil field shape); RGB is 0–255 integers; HSL is h 0–360
 * with s/l 0–100; hex is lowercase `#rrggbb`.
 */
export const formatColor = (hex: string, format: PickerFormat): string => {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  switch (format) {
    case 'hex':
      return normalizeHex(hex) ?? '#000000';
    case 'rgb':
      return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    case 'hsl': {
      const { h, s, l } = rgbToHsl(rgb);
      return `${h}, ${s}%, ${l}%`;
    }
    case 'hsb': {
      const { h, s, v } = rgbToHsv(rgb);
      return `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%`;
    }
  }
};

/**
 * Parse a field value back to `#rrggbb`. `null` means "not a colour" and the
 * caller keeps the old value — a field that guesses is worse than one that
 * refuses. `%` and unit letters are tolerated; out-of-range channels clamp.
 */
export const parseColorField = (text: string, format: PickerFormat): string | null => {
  switch (format) {
    case 'hex':
      return normalizeHex(text);
    case 'rgb': {
      const parts = parseTriple(text);
      if (!parts) return null;
      return rgbToHex({ r: clampInt(parts[0], 0, 255), g: clampInt(parts[1], 0, 255), b: clampInt(parts[2], 0, 255) });
    }
    case 'hsl': {
      const parts = parseTriple(text);
      if (!parts) return null;
      return rgbToHex(hslToRgb({ h: parts[0], s: clampInt(parts[1], 0, 100), l: clampInt(parts[2], 0, 100) }));
    }
    case 'hsb': {
      const parts = parseTriple(text);
      if (!parts) return null;
      return hsvToHex({ h: parts[0], s: clampInt(parts[1], 0, 100) / 100, v: clampInt(parts[2], 0, 100) / 100 });
    }
  }
};
