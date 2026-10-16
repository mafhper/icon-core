/**
 * IC77 — HSV math for the studio colour picker (Passo 3).
 *
 * Kept local and pure: the picker's 2D area and hue slider speak HSV, the
 * document speaks hex. `normalizeHex` accepts `#rgb`/`#rrggbb` with or without
 * the hash; `null` means "not a colour" and callers decide what to do.
 */
export interface Hsv {
  /** 0–360, 0 = red. */
  h: number;
  /** 0–1. */
  s: number;
  /** 0–1. */
  v: number;
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
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round((value + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r1)}${channel(g1)}${channel(b1)}`;
};
