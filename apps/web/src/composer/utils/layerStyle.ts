import type { Fill, IconLayer, LayerEffect } from '@iconcore/shared';

const DEFAULT_GRADIENT_STOPS = '#f3d18a, #6bb7d8';

/** Convert a Fill into a CSS color / gradient string for DOM previews. */
export const fillToCss = (fill?: Fill): string => {
  if (!fill) return 'transparent';
  if (fill.kind === 'solid') return fill.color ?? '#111827';
  const stops = (fill.stops ?? []).map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ');
  if (fill.kind === 'linear-gradient') {
    return `linear-gradient(${fill.angle ?? 135}deg, ${stops || DEFAULT_GRADIENT_STOPS})`;
  }
  const cx = Math.round((fill.centerX ?? 0.5) * 100);
  const cy = Math.round((fill.centerY ?? 0.5) * 100);
  const extent = Math.round((fill.radius ?? 0.5) * 200); // 0.5 → 100% (full bound)
  return `radial-gradient(ellipse ${extent}% ${extent}% at ${cx}% ${cy}%, ${stops || DEFAULT_GRADIENT_STOPS})`;
};

/** Solid color extracted from a Fill, falling back to a neutral dark. */
export const fillColor = (fill?: Fill): string =>
  fill?.kind === 'solid' ? fill.color ?? '#111827' : '#111827';

/** Pixel footprint of a layer on the canvas (shape size, or 70% of canvas). */
export const layerSize = (layer: IconLayer, canvasSize: number) => {
  const shape = layer.source.shape;
  if (shape) return { width: shape.width, height: shape.height };
  return { width: Math.round(canvasSize * 0.7), height: Math.round(canvasSize * 0.7) };
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
