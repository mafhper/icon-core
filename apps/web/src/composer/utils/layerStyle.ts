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
 * The honest stroke label under a non-unit scale.
 *
 * Width × scale paints completely Figma-like in both pipelines (the transform
 * scales the stroke, bit-identical canvas↔SVG) — so the number on the slider
 * is NOT what paints when scale ≠ 1. This note states the effective
 * thickness (`8 × 2 = 16px efetivos`); at scale 1 there is nothing to
 * disclose and it stays absent. Label only: the semantics (no
 * `vector-effect`, no decoupling) are untouched.
 */
export const strokeScaleNote = (width: number, scale: number): string | undefined => {
  if (scale === 1) return undefined;
  const w = Math.round(width);
  const pretty = String(Number(scale.toFixed(2)));
  return `${w} × ${pretty} = ${Math.round(width * scale)}px efetivos`;
};

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
  // Spread is additive and optional (absent = 0): the renderers read
  // `params.spread ?? 0`, so a `0` here only makes the new control open on
  // the value the engine already paints — it changes no existing entry.
  'drop-shadow': { x: 0, y: 8, blur: 16, spread: 0, color: '#000000', opacity: 0.5 },
  'inner-shadow': { x: 0, y: 6, blur: 12, spread: 0, color: '#000000', opacity: 0.35 }
};

/** Spread slider range (px), shared by the drop and inner modals. */
export const SHADOW_SPREAD_RANGE = { min: -20, max: 20 } as const;

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

/** Background-blur radius (px) for a layer, 0 when none/disabled/off. */
export const backdropBlurPx = (layer: IconLayer): number => {
  const effect = layer.effects?.find((item) => item.kind === 'backdrop-blur' && item.enabled);
  return effect ? Number(effect.params.radius ?? 0) : 0;
};

/**
 * The working background blur for the modal: the stored entry (enabled or
 * not), else a disabled default. Reading never writes. A non-positive radius
 * is off in both pipelines (zero markup, zero work), so the default 12 opens
 * on a value that visibly acts.
 */
export const resolveBackdropBlur = (layer: IconLayer): { enabled: boolean; radius: number } => {
  const stored = layer.effects?.find((effect) => effect.kind === 'backdrop-blur');
  if (stored) return { enabled: stored.enabled, radius: Number(stored.params.radius ?? 12) };
  return { enabled: false, radius: 12 };
};

/** Enable or disable the background blur without destroying params. */
export const setBackdropBlurEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const { radius } = resolveBackdropBlur(layer);
  return setEffect(layer, { kind: 'backdrop-blur', enabled, params: { radius } });
};

/** Edit the background radius from the modal: materialises and enables. */
export const patchBackdropBlur = (layer: IconLayer, radius: number): LayerEffect[] =>
  setEffect(layer, { kind: 'backdrop-blur', enabled: true, params: { radius } });

/** Glass defaults: the v1 taste call (white tint, soft blur, lit edge, whisper of frost). */
export const GLASS_DEFAULTS: Record<string, number | string> = {
  tint: '#ffffff',
  tintOpacity: 0.2,
  blurRadius: 14,
  edgeHighlight: 0.6,
  frost: 0.25
};

/** The working glass entry for the modal: stored, else a disabled default. Reading never writes. */
export const resolveGlass = (layer: IconLayer): LayerEffect =>
  layer.effects?.find((effect) => effect.kind === 'glass') ?? {
    kind: 'glass',
    enabled: false,
    params: { ...GLASS_DEFAULTS }
  };

/** Whether the glass row reads ON: enabled with at least one live param (mirrors the engine rule). */
export const isGlassActive = (layer: IconLayer): boolean => {
  const glass = layer.effects?.find((effect) => effect.kind === 'glass');
  if (!glass?.enabled) return false;
  return (
    Number(glass.params.blurRadius ?? 0) > 0 ||
    Number(glass.params.tintOpacity ?? 0) > 0 ||
    Number(glass.params.edgeHighlight ?? 0) > 0 ||
    Number(glass.params.frost ?? 0) > 0
  );
};

/** Enable or disable glass without destroying params. */
export const setGlassEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const entry: LayerEffect = { ...resolveGlass(layer), enabled };
  return setEffect(layer, entry);
};

/** Noise-grain defaults: whisper of monochrome film grain. */
export const NOISE_DEFAULTS: Record<string, number | boolean> = {
  amount: 0.3,
  size: 2,
  monochrome: true
};

/** Grain cell slider range (px): the proven interval — the engine clamps past it. */
export const NOISE_SIZE_RANGE = { min: 1, max: 8 } as const;

/** The working noise entry for the modal: stored, else a disabled default. Reading never writes. */
export const resolveNoise = (layer: IconLayer): LayerEffect =>
  layer.effects?.find((effect) => effect.kind === 'noise-grain') ?? {
    kind: 'noise-grain',
    enabled: false,
    params: { ...NOISE_DEFAULTS }
  };

/** Whether the grain row reads ON: enabled with a live amount (mirrors the engine rule). */
export const isNoiseActive = (layer: IconLayer): boolean => {
  const noise = layer.effects?.find((effect) => effect.kind === 'noise-grain');
  return Boolean(noise?.enabled) && Number(noise?.params.amount ?? 0) > 0;
};

/** Enable or disable grain without destroying params. */
export const setNoiseEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const entry: LayerEffect = { ...resolveNoise(layer), enabled };
  return setEffect(layer, entry);
};

/**
 * Edit grain params from the modal. Materialises and enables. Only the three
 * v1 keys survive; anything else is dropped.
 */
export const patchNoise = (
  layer: IconLayer,
  patch: Partial<Record<'amount' | 'size' | 'monochrome', number | boolean>>
): LayerEffect[] => {
  const base = resolveNoise(layer);
  const params = { ...base.params };
  for (const key of ['amount', 'size', 'monochrome'] as const) {
    if (patch[key] !== undefined) params[key] = patch[key] as number | boolean;
  }
  return setEffect(layer, { ...base, enabled: true, params });
};

/**
 * Edit glass params from the modal. Materialises the entry and enables it,
 * like every other patch: a control that moves with no visible result does
 * not exist. Only the five v1 keys survive — anything else is dropped, so a
 * typo cannot smuggle a sixth param into the document.
 */
export const patchGlass = (
  layer: IconLayer,
  patch: Partial<Record<'tint' | 'tintOpacity' | 'blurRadius' | 'edgeHighlight' | 'frost', number | string>>
): LayerEffect[] => {
  const base = resolveGlass(layer);
  const params = { ...base.params };
  for (const key of ['tint', 'tintOpacity', 'blurRadius', 'edgeHighlight', 'frost'] as const) {
    if (patch[key] !== undefined) params[key] = patch[key] as number | string;
  }
  return setEffect(layer, { ...base, enabled: true, params });
};

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

/**
 * Bloom (Tier 3) — the intense glow: stacked zero-offset coats. A kind of its
 * own (not a drop preset) because the coat count is a number no drop control
 * owns. Defaults are the SPIKE 3.1 proof (blue 18px at 0.9, two coats).
 */
export const BLOOM_DEFAULTS: Record<string, number | string> = {
  color: '#66aaff',
  opacity: 0.9,
  blur: 18,
  intensity: 2
};

/** Bloom slider ranges: blur rides the glow interval, coats are capped (SVG cost is linear in coats). */
export const BLOOM_BLUR_RANGE = { min: 0, max: 80 } as const;
export const BLOOM_INTENSITY_RANGE = { min: 1, max: 5 } as const;

/** The working bloom entry for the modal: stored, else a disabled default. Reading never writes. */
export const resolveBloom = (layer: IconLayer): LayerEffect =>
  layer.effects?.find((effect) => effect.kind === 'bloom') ?? {
    kind: 'bloom',
    enabled: false,
    params: { ...BLOOM_DEFAULTS }
  };

/** Whether the bloom row reads ON: enabled with blur and at least one coat (mirrors the engine rule). */
export const isBloomActive = (layer: IconLayer): boolean => {
  const bloom = layer.effects?.find((effect) => effect.kind === 'bloom');
  if (!bloom?.enabled) return false;
  return Number(bloom.params.blur ?? 0) > 0 && Math.round(Number(bloom.params.intensity ?? 0)) >= 1;
};

/** Enable or disable bloom without destroying params. */
export const setBloomEnabled = (layer: IconLayer, enabled: boolean): LayerEffect[] => {
  const entry: LayerEffect = { ...resolveBloom(layer), enabled };
  return setEffect(layer, entry);
};

/**
 * Edit bloom params from the modal. Materialises the entry and enables it,
 * like every other patch: a control that moves with no visible result does
 * not exist. Only the four v1 keys survive, clamped to their ranges — a coat
 * count outside 1–5 cannot be smuggled into the document.
 */
export const patchBloom = (
  layer: IconLayer,
  patch: Partial<Record<'color' | 'opacity' | 'blur' | 'intensity', number | string>>
): LayerEffect[] => {
  const base = resolveBloom(layer);
  const params = { ...base.params };
  if (patch.color !== undefined) params.color = patch.color;
  if (patch.opacity !== undefined) params.opacity = Math.max(0, Math.min(1, Number(patch.opacity)));
  if (patch.blur !== undefined) {
    params.blur = Math.max(BLOOM_BLUR_RANGE.min, Math.min(BLOOM_BLUR_RANGE.max, Number(patch.blur)));
  }
  if (patch.intensity !== undefined) {
    params.intensity = Math.max(
      BLOOM_INTENSITY_RANGE.min,
      Math.min(BLOOM_INTENSITY_RANGE.max, Math.round(Number(patch.intensity)))
    );
  }
  return setEffect(layer, { ...base, enabled: true, params });
};

/** Shadow paint, with the defaults the renderers assume. No bare literals upstream. */
export const effectPaint = (effect: LayerEffect, fallbackOpacity: number): { color: string; alpha: number } => ({
  color: String(effect.params.color ?? '#000000'),
  alpha: Number(effect.params.opacity ?? fallbackOpacity)
});
