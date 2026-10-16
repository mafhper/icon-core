import type { Fill, GradientFill, IconLayer, LayerEffect } from '@iconcore/shared';
import type { Dimensions } from '@iconcore/shared';
import { layerBaseRect, normalizeStops, toRgba } from '@iconcore/renderer';

const stopsCss = (fill: GradientFill): string =>
  normalizeStops(fill.stops)
    .map((stop) => `${toRgba(stop.color, stop.alpha)} ${Math.round((stop.offset ?? 0) * 100)}%`)
    .join(', ');

/** Convert a Fill into a CSS color / gradient string for DOM previews. */
export const fillToCss = (fill?: Fill): string => {
  if (!fill || fill.kind === 'none') return 'transparent';
  if (fill.kind === 'solid') return toRgba(fill.color ?? '#111827', fill.alpha ?? 1);

  const stops = stopsCss(fill);

  if (fill.kind === 'linear-gradient') {
    return `linear-gradient(${fill.angle ?? 90}deg, ${stops})`;
  }

  if (fill.kind === 'angular-gradient') {
    const cx = Math.round((fill.centerX ?? 0.5) * 100);
    const cy = Math.round((fill.centerY ?? 0.5) * 100);
    return `conic-gradient(from ${fill.angle ?? 0}deg at ${cx}% ${cy}%, ${stops})`;
  }

  // Radial and diamond (CSS has no diamond gradient — approximate as radial).
  const cx = Math.round((fill.centerX ?? 0.5) * 100);
  const cy = Math.round((fill.centerY ?? 0.5) * 100);
  const extent = Math.round((fill.radius ?? 0.5) * 200); // 0.5 → 100% (full bound)
  return `radial-gradient(ellipse ${extent}% ${extent}% at ${cx}% ${cy}%, ${stops})`;
};

/** Solid color extracted from a Fill, falling back to a neutral dark. */
export const fillColor = (fill?: Fill): string =>
  fill?.kind === 'solid' ? fill.color ?? '#111827' : '#111827';

/**
 * Pixel footprint of a layer on the canvas, before its transform scale.
 * Delegates to the shared renderer geometry so the editor overlay, snapping and
 * the exporter agree on every layer's size.
 */
export const layerSize = (layer: IconLayer, canvas: Dimensions) => {
  const rect = layerBaseRect(layer, canvas);
  return { width: rect.w, height: rect.h };
};

/** CSS border-radius for a shape layer based on its shape kind. */
export const borderRadiusForLayer = (layer: IconLayer): string => {
  const shape = layer.source.shape;
  if (!shape) return '0px';
  if (shape.kind === 'circle' || shape.kind === 'line') return '999px';
  if (shape.kind === 'squircle') return '28%';
  if (shape.kind === 'rounded-rectangle') return `${shape.cornerRadius ?? 32}px`;
  return '0px';
};

const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

/** CSS clip-path for shapes that border-radius can't express (triangle, star). */
export const clipPathForLayer = (layer: IconLayer): string | undefined => {
  const shape = layer.source.shape;
  if (!shape) return undefined;
  if (shape.kind === 'triangle') return 'polygon(50% 0%, 100% 100%, 0% 100%)';
  if (shape.kind === 'star') return STAR_CLIP;
  return undefined;
};

/** CSS box-shadow string for a layer's enabled depth-shadow effect, if any. */
export const shadowCssForLayer = (layer: IconLayer): string | undefined => {
  const effect = layer.effects?.find((item) => item.kind === 'depth-shadow' && item.enabled);
  if (!effect) return undefined;
  const x = Number(effect.params.x ?? 0);
  const y = Number(effect.params.y ?? 14);
  const blur = Number(effect.params.blur ?? 28);
  const color = String(effect.params.color ?? 'rgba(15, 23, 42, 0.28)');
  return `${x}px ${y}px ${blur}px ${color}`;
};

/** Surface-blur radius (px) for a layer, 0 when none/disabled. */
export const layerBlurPx = (layer: IconLayer): number => {
  const effect = layer.effects?.find((item) => item.kind === 'surface-blur' && item.enabled);
  return effect ? Number(effect.params.radius ?? 0) : 0;
};

/** The layer's depth-shadow effect, or a disabled default for the inspector. */
export const getShadow = (layer: IconLayer): LayerEffect =>
  layer.effects?.find((effect) => effect.kind === 'depth-shadow') ?? {
    kind: 'depth-shadow',
    enabled: false,
    params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' }
  };

/** Return a new effects array with the depth-shadow effect upserted. */
export const setShadow = (layer: IconLayer, shadow: LayerEffect): LayerEffect[] => {
  const effects = layer.effects ?? [];
  const exists = effects.some((effect) => effect.kind === 'depth-shadow');
  return exists
    ? effects.map((effect) => effect.kind === 'depth-shadow' ? shadow : effect)
    : [...effects, shadow];
};

const SHADOW_DEFAULTS: Record<string, Record<string, number | string>> = {
  'drop-shadow': { x: 0, y: 8, blur: 16, color: '#000000', opacity: 0.5 },
  'inner-shadow': { x: 0, y: 6, blur: 12, color: '#000000', opacity: 0.35 }
};

/** A generic shadow effect (drop/inner), or a disabled default for the inspector. */
export const getEffect = (layer: IconLayer, kind: 'drop-shadow' | 'inner-shadow'): LayerEffect =>
  layer.effects?.find((effect) => effect.kind === kind) ?? {
    kind,
    enabled: false,
    params: { ...SHADOW_DEFAULTS[kind] }
  };

/** Return a new effects array with a generic shadow effect upserted. */
export const setEffect = (layer: IconLayer, effect: LayerEffect): LayerEffect[] => {
  const effects = layer.effects ?? [];
  const exists = effects.some((item) => item.kind === effect.kind);
  return exists
    ? effects.map((item) => (item.kind === effect.kind ? effect : item))
    : [...effects, effect];
};

/**
 * A glow is not an effect kind: it is a drop shadow with zero offset. The
 * preset exists so the inspector offers one honest button instead of three
 * coordinated sliders pretending to be a feature.
 */
export const GLOW_PRESET: LayerEffect = {
  kind: 'drop-shadow',
  enabled: true,
  params: { x: 0, y: 0, blur: 24, color: '#3f6ce0', opacity: 0.65 }
};

/** Shadow paint, with the defaults the renderers assume. No bare literals upstream. */
export const effectPaint = (effect: LayerEffect, fallbackOpacity: number): { color: string; alpha: number } => ({
  color: String(effect.params.color ?? '#000000'),
  alpha: Number(effect.params.opacity ?? fallbackOpacity)
});
