import type { GradientStop } from '@iconcore/shared';
import { clamp01, mixOklab, parseHex, rgbToHex, toRgba } from './color';

export const DEFAULT_STOPS: GradientStop[] = [
  { offset: 0, color: '#f3d18a' },
  { offset: 1, color: '#6bb7d8' }
];

/** Sorted copy with `alpha` defaulted to 1. */
export const normalizeStops = (stops: GradientStop[] | undefined): GradientStop[] =>
  (stops && stops.length >= 2 ? stops : DEFAULT_STOPS)
    .map((stop) => ({ ...stop, alpha: stop.alpha ?? 1 }))
    .sort((a, b) => a.offset - b.offset);

/** Sample the gradient at `t` (0..1), interpolating in Oklab. Returns an rgba() string. */
export const sampleStops = (stops: GradientStop[] | undefined, t: number): string => {
  const list = normalizeStops(stops);
  const x = clamp01(t);
  const first = list[0];
  const last = list[list.length - 1];
  if (x <= first.offset) return toRgba(first.color, first.alpha);
  if (x >= last.offset) return toRgba(last.color, last.alpha);

  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (x < a.offset || x > b.offset) continue;
    const span = b.offset - a.offset || 1;
    const local = (x - a.offset) / span;
    const from = parseHex(a.color);
    const to = parseHex(b.color);
    const alpha = (a.alpha ?? 1) + ((b.alpha ?? 1) - (a.alpha ?? 1)) * local;
    if (!from || !to) return toRgba(local < 0.5 ? a.color : b.color, alpha);
    return toRgba(rgbToHex(mixOklab(from, to, local)), alpha);
  }
  return toRgba(last.color, last.alpha);
};

/**
 * Flatten stops into dense samples with hex + alpha kept apart (SVG wants
 * `stop-color`/`stop-opacity`; canvas wants rgba()).
 */
export const expandStopsDetailed = (
  stops: GradientStop[] | undefined,
  stepsPerSegment = 10
): Array<{ offset: number; color: string; alpha: number }> => {
  const list = normalizeStops(stops);
  const out: Array<{ offset: number; color: string; alpha: number }> = [];
  const steps = Math.max(2, Math.round(stepsPerSegment));

  const detailAt = (t: number): { color: string; alpha: number } => {
    const rgba = sampleStops(list, t);
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(rgba);
    if (!match) return { color: rgba, alpha: 1 };
    const hex = `#${[match[1], match[2], match[3]]
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')}`;
    return { color: hex, alpha: match[4] === undefined ? 1 : Number(match[4]) };
  };

  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    for (let s = 0; s < steps; s++) {
      const local = s / steps;
      const offset = a.offset + (b.offset - a.offset) * local;
      out.push({ offset, ...detailAt(offset) });
    }
  }
  const last = list[list.length - 1];
  out.push({ offset: last.offset, ...detailAt(last.offset) });
  return out;
};

/**
 * Flatten stops into a dense list of rgba() samples. Canvas interpolates
 * linearly in sRGB, so we bake the Oklab interpolation into extra stops.
 */
export const expandStops = (
  stops: GradientStop[] | undefined,
  stepsPerSegment = 10
): Array<{ offset: number; color: string }> =>
  expandStopsDetailed(stops, stepsPerSegment).map((stop) => ({
    offset: stop.offset,
    color: toRgba(stop.color, stop.alpha)
  }));

/** Unit direction for a CSS linear-gradient angle (0 = to top, clockwise). */
export const cssAngleVector = (angleDeg: number): { x: number; y: number } => {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
};

/** `createConicGradient` start angle (radians, 0 = +x axis) for a CSS `from <angle>` (0 = up). */
export const conicStartRadians = (angleDeg: number): number =>
  ((angleDeg - 90) * Math.PI) / 180;
