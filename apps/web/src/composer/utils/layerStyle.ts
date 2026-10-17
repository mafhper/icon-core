import type { Fill, GradientFill, IconLayer, LayerEffect } from '@iconcore/shared';
import type { Dimensions } from '@iconcore/shared';
import { layerBaseRect, normalizeStops, parseHex, parseRgba, rgbToHex, toRgba } from '@iconcore/renderer';

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
 * The legacy composer-era depth shadow stored on the layer, enabled or not.
 *
 * The old switch is gone from the UI (absorbed by the Drop shadow modal), but
 * old projects still carry the entry and the engine still paints it
 * byte-for-byte — so every read below goes through here first.
 */
export const findLegacyShadow = (layer: IconLayer): LayerEffect | undefined =>
  layer.effects?.find((effect) => effect.kind === 'depth-shadow');

/**
 * Whether any shadow paints on the layer: the generic drop shadow or the
 * legacy depth shadow. The Drop row reads this, not the drop entry alone —
 * a factory layer carries an enabled legacy shadow with no drop entry yet,
 * and the row saying OFF over a painted shadow would be a lie.
 */
export const hasPaintedShadow = (layer: IconLayer): boolean =>
  (layer.effects ?? []).some(
    (effect) =>
      (effect.kind === 'drop-shadow' || effect.kind === 'depth-shadow') && effect.enabled
  );

/**
 * Map legacy depth-shadow params onto drop-shadow params.
 *
 * x/y/blur are the same numbers in both models. The colour splits: legacy
 * carries one `rgba()` string, drop carries hex + opacity. `rgba()` and hex
 * inputs both survive the trip; anything else keeps the drop default colour
 * while the numbers still carry over. The factory default round-trips the
 * canvas paint exactly (`toRgba` of the mapped pair is the legacy string),
 * which the spec below locks — retiring a legacy shadow must not move a pixel.
 */
export const legacyToDropParams = (legacy: LayerEffect): Record<string, number | string> => {
  const drop: Record<string, number | string> = { ...SHADOW_DEFAULTS['drop-shadow'] };
  drop.x = Number(legacy.params.x ?? drop.x);
  drop.y = Number(legacy.params.y ?? drop.y);
  drop.blur = Number(legacy.params.blur ?? drop.blur);
  const raw = String(legacy.params.color ?? '');
  const rgba = parseRgba(raw);
  if (rgba) {
    drop.color = rgbToHex({ r: rgba.r, g: rgba.g, b: rgba.b });
    drop.opacity = Math.max(0, Math.min(1, rgba.a));
    return drop;
  }
  if (parseHex(raw)) {
    drop.color = raw;
    drop.opacity = Number(legacy.params.opacity ?? drop.opacity);
  }
  return drop;
};

/**
 * The working drop shadow for the modal: the stored entry, else the legacy
 * entry migrated (without retiring it — retiring happens on write), else the
 * defaults. Reading never writes: opening the modal changes nothing.
 */
export const resolveDropShadow = (layer: IconLayer): LayerEffect => {
  const stored = layer.effects?.find((effect) => effect.kind === 'drop-shadow');
  if (stored) return stored;
  const legacy = findLegacyShadow(layer);
  if (legacy) {
    return { kind: 'drop-shadow', enabled: false, params: legacyToDropParams(legacy) };
  }
  return { kind: 'drop-shadow', enabled: false, params: { ...SHADOW_DEFAULTS['drop-shadow'] } };
};

const retireLegacy = (effects: LayerEffect[]): LayerEffect[] =>
  effects.map((effect) => (effect.kind === 'depth-shadow' ? { ...effect, enabled: false } : effect));

/**
 * Enable or disable the Drop shadow row.
 *
 * Enabling upserts the resolved drop shadow (migrated legacy numbers when
 * there is no drop entry yet) and retires an enabled legacy shadow in the
 * same write — the two entries paint through different engine branches
 * (canvas prefers legacy, SVG prefers drop), so leaving both enabled would
 * split the pipelines. Disabling turns both off with params preserved, so a
 * legacy project can come back to its exact numbers.
 */
export const setDropEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const effects = layer.effects ?? [];
  if (!enabled) {
    // Disabling invents no entry: with no drop stored there is nothing to
    // turn off beyond the legacy paint. The entry appears on enable or edit.
    if (!effects.some((effect) => effect.kind === 'drop-shadow')) return retireLegacy(effects);
    return retireLegacy(
      effects.map((effect) => (effect.kind === 'drop-shadow' ? { ...effect, enabled: false } : effect))
    );
  }
  const drop = resolveDropShadow(layer);
  const next = effects.some((effect) => effect.kind === 'drop-shadow')
    ? effects.map((effect) => (effect.kind === 'drop-shadow' ? { ...drop, enabled } : effect))
    : [...effects, { ...drop, enabled }];
  return retireLegacy(next);
};

/**
 * Edit drop-shadow params from the modal.
 *
 * The edit materialises the entry (migrated when it does not exist yet) and
 * retires the legacy shadow in the same write, for the same split-pipeline
 * reason as `setDropEnabled`. It also enables the entry: the modal is only
 * reachable deliberately, and a slider that moves with no visible result
 * would be a control that does not act. The row switch stays the off-ramp.
 */
export const patchDropShadow = (
  layer: IconLayer,
  patch: Record<string, number | string>
): LayerEffect[] => {
  const drop: LayerEffect = {
    ...resolveDropShadow(layer),
    enabled: true,
    params: { ...resolveDropShadow(layer).params, ...patch }
  };
  const effects = layer.effects ?? [];
  const next = effects.some((effect) => effect.kind === 'drop-shadow')
    ? effects.map((effect) => (effect.kind === 'drop-shadow' ? drop : effect))
    : [...effects, drop];
  return retireLegacy(next);
};

/**
 * Edit inner-shadow params from the modal.
 *
 * Same contract as `patchDropShadow`: the edit materialises the entry and
 * enables it, so every control in the modal acts. Unlike drop, inner never
 * touches the legacy depth shadow — the composition test locks that enabling
 * one never retires the other.
 */
export const patchInnerShadow = (
  layer: IconLayer,
  patch: Record<string, number | string>
): LayerEffect[] => {
  const inner: LayerEffect = {
    ...getEffect(layer, 'inner-shadow'),
    enabled: true,
    params: { ...getEffect(layer, 'inner-shadow').params, ...patch }
  };
  return setEffect(layer, inner);
};

/**
 * The working layer blur for the modal: the stored entry (enabled or not —
 * the switch owns the state, the modal owns the number), else a disabled
 * default. Reading never writes.
 */
export const resolveLayerBlur = (layer: IconLayer): { enabled: boolean; radius: number } => {
  const stored = layer.effects?.find((effect) => effect.kind === 'surface-blur');
  if (stored) return { enabled: stored.enabled, radius: Number(stored.params.radius ?? 8) };
  return { enabled: false, radius: 8 };
};

/**
 * Enable or disable the layer blur without destroying params: disabling keeps
 * the entry with its radius (a disabled blur emits zero markup by engine
 * construction), so coming back restores the exact number.
 */
export const setLayerBlurEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const { radius } = resolveLayerBlur(layer);
  const entry: LayerEffect = { kind: 'surface-blur', enabled, params: { radius } };
  return setEffect(layer, entry);
};

/**
 * Edit the blur radius from the modal. Materialises the entry and enables it,
 * like the shadow patches: a slider that moves with no visible result would
 * be a control that does not act.
 */
export const patchLayerBlur = (layer: IconLayer, radius: number): LayerEffect[] =>
  setEffect(layer, { kind: 'surface-blur', enabled: true, params: { radius } });

/**
 * Whether the layer currently wears a glow: an enabled drop shadow with zero
 * offset. The Glow row reads this, not the drop entry alone.
 */
export const isGlowActive = (layer: IconLayer): boolean => {
  const drop = layer.effects?.find((effect) => effect.kind === 'drop-shadow');
  return Boolean(drop?.enabled) && Number(drop?.params.x ?? 0) === 0 && Number(drop?.params.y ?? 0) === 0;
};

/**
 * Enable or disable the Glow row.
 *
 * Enabling never duplicates: over an active drop it zeroes the offsets in
 * place (blur and colour stay the person's); over a legacy shadow it migrates
 * the numbers centred; from nothing it applies the preset. Disabling turns
 * the drop entry off with params preserved.
 */
export const setGlowEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const effects = layer.effects ?? [];
  if (!enabled) {
    return effects.map((effect) =>
      effect.kind === 'drop-shadow' ? { ...effect, enabled: false } : effect
    );
  }
  const stored = effects.find((effect) => effect.kind === 'drop-shadow');
  if (stored) {
    const centred: LayerEffect = {
      ...stored,
      enabled: true,
      params: { ...stored.params, x: 0, y: 0 }
    };
    return retireLegacy(
      effects.map((effect) => (effect.kind === 'drop-shadow' ? centred : effect))
    );
  }
  const legacy = findLegacyShadow(layer);
  const glow: LayerEffect = legacy
    ? { kind: 'drop-shadow', enabled: true, params: { ...legacyToDropParams(legacy), x: 0, y: 0 } }
    : { ...GLOW_PRESET, params: { ...GLOW_PRESET.params } };
  return retireLegacy([...effects, glow]);
};

/**
 * Edit glow params from the modal. Blur and colour write through, offsets
 * stay zero: the modal shows X/Y as locked, so writing anything else would
 * make the display a lie. Materialises and enables like the other patches.
 */
export const patchGlow = (
  layer: IconLayer,
  patch: { blur?: number; color?: string; opacity?: number }
): LayerEffect[] => {
  const base = resolveDropShadow(layer);
  const glow: LayerEffect = {
    ...base,
    enabled: true,
    params: { ...base.params, ...patch, x: 0, y: 0 }
  };
  const effects = layer.effects ?? [];
  const next = effects.some((effect) => effect.kind === 'drop-shadow')
    ? effects.map((effect) => (effect.kind === 'drop-shadow' ? glow : effect))
    : [...effects, glow];
  return retireLegacy(next);
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
