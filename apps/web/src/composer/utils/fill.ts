import type { Fill, GradientFill, GradientStop } from '@iconcore/shared';
import { normalizeStops } from '@iconcore/renderer';
import { brandGradientFill, DEFAULT_SOLID_COLOR, EMPTY_SOLID_COLOR } from '../constants';

export const GRADIENT_KINDS = [
  'linear-gradient',
  'radial-gradient',
  'angular-gradient',
  'diamond-gradient'
] as const;

export type GradientKind = (typeof GRADIENT_KINDS)[number];

/** Options of the unified Fill type selector (Figma/OpenPencil-style). */
export const FILL_KIND_OPTIONS = [
  { value: 'solid', label: 'Solid color' },
  { value: 'linear-gradient', label: 'Linear gradient' },
  { value: 'radial-gradient', label: 'Radial gradient' },
  { value: 'angular-gradient', label: 'Angular gradient' },
  { value: 'diamond-gradient', label: 'Diamond gradient' },
  { value: 'none', label: 'Transparent' }
] as const;

export const isGradientFill = (fill: Fill | undefined): fill is GradientFill =>
  fill != null && (GRADIENT_KINDS as readonly string[]).includes(fill.kind);

/** Geometry of a gradient, normalised across the four kinds (all optional). */
const geometryOf = (fill: GradientFill) => ({
  angle: 'angle' in fill ? fill.angle : undefined,
  centerX: 'centerX' in fill ? fill.centerX : undefined,
  centerY: 'centerY' in fill ? fill.centerY : undefined,
  radius: 'radius' in fill ? fill.radius : undefined
});

/**
 * Build a gradient of `kind` with kind-appropriate defaults. `base` carries over
 * the geometry of the previous gradient so switching linear ↔ radial ↔ angular
 * keeps the angle/centre the user already tuned.
 */
export const makeGradient = (
  kind: GradientKind,
  stops: GradientStop[],
  base: Partial<ReturnType<typeof geometryOf>> = {}
): GradientFill => {
  if (kind === 'linear-gradient') return { kind, stops, angle: base.angle ?? 90 };
  if (kind === 'angular-gradient') {
    return { kind, stops, angle: base.angle ?? 0, centerX: base.centerX ?? 0.5, centerY: base.centerY ?? 0.5 };
  }
  return {
    kind,
    stops,
    centerX: base.centerX ?? 0.5,
    centerY: base.centerY ?? 0.5,
    radius: base.radius ?? 0.5
  };
};

/**
 * Change the *kind* of a fill while keeping as much of the current value as
 * possible — the model behind one unified Fill control:
 *
 * - solid → gradient: the current colour seeds the first stop (so the swap is
 *   visually continuous instead of jumping to the brand preset);
 * - gradient → gradient: stops and geometry are preserved, only the kind changes;
 * - gradient → solid: the first stop becomes the solid colour;
 * - anything → none: `{ kind: 'none' }`.
 */
export const convertFillKind = (fill: Fill | undefined, kind: Fill['kind']): Fill => {
  if (fill?.kind === kind) return fill;
  if (kind === 'none') return { kind: 'none' };

  if (kind === 'solid') {
    if (isGradientFill(fill)) {
      const [first] = normalizeStops(fill.stops);
      if (first?.alpha != null && first.alpha < 1) {
        return { kind: 'solid', color: first.color, alpha: first.alpha };
      }
      return { kind: 'solid', color: first?.color ?? DEFAULT_SOLID_COLOR };
    }
    const color = fill?.kind === 'solid' ? fill.color ?? DEFAULT_SOLID_COLOR : DEFAULT_SOLID_COLOR;
    const alpha = fill?.kind === 'solid' ? fill.alpha : undefined;
    return alpha != null ? { kind: 'solid', color, alpha } : { kind: 'solid', color };
  }

  if (isGradientFill(fill)) return makeGradient(kind, normalizeStops(fill.stops), geometryOf(fill));

  const preset = brandGradientFill();
  const presetStops = preset.stops ?? [];
  const color = fill?.kind === 'solid' ? fill.color ?? DEFAULT_SOLID_COLOR : DEFAULT_SOLID_COLOR;
  const alpha = fill?.kind === 'solid' ? fill.alpha : undefined;
  const stops: GradientStop[] = presetStops.map((stop, index) =>
    index === 0 ? { offset: stop.offset, color, ...(alpha != null ? { alpha } : {}) } : stop
  );
  return makeGradient(kind, stops, { angle: kind === 'linear-gradient' ? preset.angle : undefined });
};

/** Flat colour + alpha of a fill, for swatches that cannot render a gradient. */
export const solidOf = (fill: Fill | undefined): { color: string; alpha: number } => {
  if (fill?.kind === 'solid') return { color: fill.color ?? EMPTY_SOLID_COLOR, alpha: fill.alpha ?? 1 };
  if (isGradientFill(fill)) {
    const [first] = normalizeStops(fill.stops);
    return { color: first?.color ?? EMPTY_SOLID_COLOR, alpha: first?.alpha ?? 1 };
  }
  return { color: EMPTY_SOLID_COLOR, alpha: 1 };
};
