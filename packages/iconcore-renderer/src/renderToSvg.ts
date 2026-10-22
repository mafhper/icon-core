import type { BlendMode, CanvasMaskShape, Dimensions, Fill, GradientFill, IconCoreProject, IconLayer, IconVariant, ShapeDefinition, ImageFilter, LayerEffect } from '@iconcore/shared';
import { resolveMaskRadius, resolveSize } from '@iconcore/shared';
import { toRgba } from './color';
import { escapeXml } from './escapeXml';
import { layerBaseRect } from './geometry';
import { superellipsePathD } from './geometry/superellipse';
import { smoothRectPathD } from './geometry/smoothCorners';
import { conicStartRadians, cssAngleVector, expandStopsDetailed, sampleStops } from './gradient';
import { parseSvgIntrinsicSize, namespaceSvgIds, setSvgViewport } from './svgSize';
import { applySvgPaintOverrides } from './svgPaint';
import { glassActive, noiseActive, noiseSizePx } from './composeLayers';
import { isItalic, resolveTextPlacement } from './textLayout';
import type { RenderBackground } from './types';

/**
 * Peak rect opacity for the glass frost coat at frost = 1.
 *
 * The canvas tile carries ±44/255 of variance at an alpha of
 * `FROST_PEAK_ALPHA` (0.16); `feTurbulence` fields run hotter, so the SVG
 * rect runs cooler to land in the same subtle band. Calibrated once against
 * the parity fixture — both coats stay whisper-quiet and the gate absorbs
 * the texture difference (grain positions are engine-specific by nature).
 */
const FROST_SVG_PEAK = 0.22;

/**
 * Peak rect opacity for the noise-grain coat at amount = 1.
 *
 * Same calibration story as the frost: the canvas tile carries ±44/255 of
 * variance at `NOISE_PEAK_ALPHA` (0.5); turbulence fields run cooler per
 * opacity point, so the rect runs hotter to land in the same band.
 * Calibrated once against the parity fixture (mean deviation per channel:
 * canvas 16.3, svg 15.4 at peak 0.7) — grain positions stay
 * engine-specific, density matches.
 */
const NOISE_SVG_PEAK = 0.7;

/**
 * A superellipse outline for the SVG clip path.
 *
 * Same cubic approximation the canvas backend uses in `clipSquircle`, so the
 * raster and vector pipelines agree on where the edge is — the parity the
 * `IC51`/`IC-N6` work established for geometry.
 */
const squirclePath = (size: number): string =>
  `<path d="${superellipsePathD(size, size)}"/>`;

/**
 * CSS `mix-blend-mode` for a domain `BlendMode`.
 *
 * `normal` is the default and is omitted so an ordinary layer's markup is
 * byte-identical to what it was before blend support existed. The five modes the
 * domain allows are all CSS spellings, so this is a lookup rather than a
 * translation — written as a map so a future mode fails loudly instead of
 * silently rendering as `normal`.
 */
const blendModeAttr = (mode: BlendMode | undefined): string => {
  if (!mode || mode === 'normal') return '';
  return ` style="mix-blend-mode:${mode}"`;
};

const resolveLayer = (layer: IconLayer, variant: IconVariant): IconLayer => {
  const override = layer.variantOverrides?.[variant];
  if (!override) return layer;
  return {
    ...layer,
    ...override,
    source: override.source ? { ...layer.source, ...override.source } : layer.source,
    transform: override.transform ? { ...layer.transform, ...override.transform } : layer.transform,
    text: override.text ? { ...layer.text, ...override.text } as IconLayer['text'] : layer.text,
    effects: override.effects ?? layer.effects
  };
};

const gradStopsMarkup = (fill: GradientFill): string =>
  expandStopsDetailed(fill.stops)
    .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.alpha}"/>`)
    .join('');

/**
 * Layer transform, mirroring the Canvas2D backend's `applyTransform`
 * (`backends/canvas.ts`): scale and rotate happen **around the canvas centre**
 * and `x`/`y` are offsets **from** that centre.
 *
 * The previous form — `translate(x,y) scale(s)` — is a transform around the
 * *origin*: it scaled the already-centred artwork away from the canvas, so any
 * project with `scale ≠ 1` exported an SVG whose content fell outside the
 * viewBox and was visibly cropped. Keep this in lockstep with
 * `applyTransform`; changing one without the other reintroduces the drift.
 */
const layerTransformAttr = (canvas: Dimensions, transform: IconLayer['transform']): string => {
  const halfW = canvas.width / 2;
  const halfH = canvas.height / 2;
  const { x = 0, y = 0, scale = 1, rotation = 0 } = transform ?? {};
  return (
    `translate(${halfW + x},${halfH + y}) ` +
    `rotate(${rotation}) ` +
    `scale(${scale}) ` +
    `translate(${-halfW},${-halfH})`
  );
};

/**
 * SVG paint for fills that map to a native gradient/colour. Returns `null` for
 * `'none'`; angular/diamond are approximated separately (SVG has no conic
 * gradient) — see `approximationMarkup`.
 */
const paintFor = (fill: Fill, id: string): { defs: string; paint: string } | null => {
  if (fill.kind === 'none') return null;

  if (fill.kind === 'solid') {
    return { defs: '', paint: toRgba(fill.color ?? '#ffffff', fill.alpha ?? 1) };
  }

  if (fill.kind === 'linear-gradient') {
    const { x: dx, y: dy } = cssAngleVector(fill.angle ?? 90);
    const x1 = (50 - dx * 50).toFixed(2);
    const y1 = (50 - dy * 50).toFixed(2);
    const x2 = (50 + dx * 50).toFixed(2);
    const y2 = (50 + dy * 50).toFixed(2);
    return {
      defs: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${gradStopsMarkup(fill)}</linearGradient>`,
      paint: `url(#${id})`
    };
  }

  if (fill.kind === 'radial-gradient') {
    const cx = ((fill.centerX ?? 0.5) * 100).toFixed(2);
    const cy = ((fill.centerY ?? 0.5) * 100).toFixed(2);
    const r = ((fill.radius ?? 0.5) * 100).toFixed(2);
    return {
      defs: `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%">${gradStopsMarkup(fill)}</radialGradient>`,
      paint: `url(#${id})`
    };
  }

  if (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient') {
    return null;
  }

  return null;
};

/**
 * Build an SVG `<filter>` element from an ImageFilter. Returns empty string
 * when no effective adjustment is present. Uses feColorMatrix for hue/saturation
 * and feComponentTransfer for brightness/contrast.
 */
const imageFilterToSvgFilter = (filter: ImageFilter | undefined, id: string): string => {
  if (!filter) return '';
  const parts: string[] = [];

  if (filter.hue) {
    parts.push(`<feColorMatrix type="hueRotate" values="${filter.hue}"/>`);
  }

  if (filter.saturation !== undefined && filter.saturation !== 100) {
    const s = filter.saturation / 100;
    parts.push(`<feColorMatrix type="saturate" values="${s}"/>`);
  }

  if (filter.brightness !== undefined && filter.brightness !== 100) {
    const b = filter.brightness / 100;
    parts.push(
      `<feComponentTransfer><feFuncR type="linear" slope="${b}"/><feFuncG type="linear" slope="${b}"/><feFuncB type="linear" slope="${b}"/></feComponentTransfer>`
    );
  }

  if (filter.contrast !== undefined && filter.contrast !== 100) {
    const c = filter.contrast / 100;
    const intercept = ((1 - c) / 2).toFixed(4);
    parts.push(
      `<feComponentTransfer><feFuncR type="linear" slope="${c}" intercept="${intercept}"/><feFuncG type="linear" slope="${c}" intercept="${intercept}"/><feFuncB type="linear" slope="${c}" intercept="${intercept}"/></feComponentTransfer>`
    );
  }

  if (parts.length === 0) return '';
  return `<filter id="${id}">${parts.join('')}</filter>`;
};

/**
 * Whether a bloom entry acts in the SVG pipeline: enabled with blur and at
 * least one coat. Mirrors the canvas `bloomActive` — one rule, two
 * pipelines, so a coat that paints on one side cannot vanish on the other.
 */
const bloomActiveSvg = (effect: LayerEffect | undefined): boolean => {
  if (!effect || !effect.enabled) return false;
  return Number(effect.params.blur ?? 0) > 0 && Math.round(Number(effect.params.intensity ?? 0)) >= 1;
};

/** Bloom coats, clamped to the same ceiling the canvas enforces. */
const bloomCoats = (effect: LayerEffect): number =>
  Math.min(5, Math.max(1, Math.round(Number(effect.params.intensity ?? 0))));

/**
 * Compose a layer's effects into one SVG filter: inner shadow (composited
 * inside the shape), then drop shadow (a glow is the same effect with zero
 * offset), then bloom (stacked zero-offset coats — the intense glow), then
 * the layer blur. Mirrors the canvas stack (`filter:` runs image adjustments,
 * bloom coats, then blur); no enabled effect produces no filter, so projects
 * without effects keep their exact markup.
 *
 * Spread rides `feMorphology` before the blur on both shadows — dilate for a
 * positive spread, erode for a negative one — the same contour-first order
 * the canvas uses (morphology before `blur()`), which is what keeps the two
 * renderings in agreement. A zero/absent spread emits no primitive at all,
 * so every project written before spread existed keeps its exact markup.
 */
const effectFilterMarkup = (effects: LayerEffect[] | undefined, id: string): string => {
  const enabled = (kind: string) => effects?.find((effect) => effect.kind === kind && effect.enabled);
  const inner = enabled('inner-shadow');
  // The composer-era depth shadow maps onto the same primitive.
  const drop = enabled('drop-shadow') ?? enabled('depth-shadow');
  const bloom = enabled('bloom');
  const blur = enabled('surface-blur');
  if (!inner && !drop && !blur && !bloomActiveSvg(bloom)) return '';

  const spreadOf = (effect: LayerEffect): number => Number(effect.params.spread ?? 0);
  /**
   * `feMorphology` step for a non-zero spread, or empty when there is none.
   *
   * The sign flips for the inner shadow, and that is not a typo: a drop
   * shadow grows by dilating the silhouette (the contour moves out), while
   * the inner construction below casts the *shape itself* (`alpha −
   * blurred`) — dilating it would push the shadow ring OUTSIDE the shape,
   * where it reads as an outer halo. Eroding shrinks the caster, which grows
   * the positive band INWARD — the CSS `inset spread` direction. Measured:
   * with the drop sign, inner ±10 sat at 10–14% fora-tolerancia against the
   * canvas (whose classic path agrees at ~2%); flipped, it converges back.
   */
  const spreadStep = (effect: LayerEffect, source: string, tag: string, flip = false): { step: string; from: string } => {
    const raw = spreadOf(effect);
    const spread = flip ? -raw : raw;
    if (spread === 0) return { step: '', from: source };
    const result = `${id}-${tag}`;
    return {
      step:
        `<feMorphology in="${source}" operator="${spread > 0 ? 'dilate' : 'erode'}" ` +
        `radius="${Math.abs(spread)}" result="${result}"/>`,
      from: result
    };
  };

  const parts: string[] = [];
  let source = 'SourceGraphic';

  if (inner) {
    const morphed = spreadStep(inner, 'SourceAlpha', 'im', true);
    if (morphed.step) parts.push(morphed.step);
    const x = Number(inner.params.x ?? 0);
    const y = Number(inner.params.y ?? 6);
    const r = Number(inner.params.blur ?? 12) / 2;
    const color = String(inner.params.color ?? 'black');
    const opacity = Number(inner.params.opacity ?? 0.35);
    parts.push(
      `<feOffset dx="${x}" dy="${y}" in="${morphed.from}" result="${id}-io"/>`,
      `<feGaussianBlur stdDeviation="${r}" in="${id}-io" result="${id}-ib"/>`,
      `<feComposite in="${id}-ib" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="${id}-ic"/>`,
      `<feFlood flood-color="${color}" flood-opacity="${opacity}" result="${id}-if"/>`,
      `<feComposite in="${id}-if" in2="${id}-ic" operator="in" result="${id}-is"/>`,
      `<feMerge result="${id}-im"><feMergeNode in="SourceGraphic"/><feMergeNode in="${id}-is"/></feMerge>`
    );
    source = `${id}-im`;
  }

  if (drop) {
    const x = Number(drop.params.x ?? 0);
    const y = Number(drop.params.y ?? 8);
    const r = Number(drop.params.blur ?? 16) / 2;
    const color = String(drop.params.color ?? 'black');
    const opacity = Number(drop.params.opacity ?? 1);
    const morphed = spreadStep(drop, 'SourceAlpha', 'dm');
    if (morphed.step) {
      // A spread shadow is the spec's own decomposition of `feDropShadow`
      // (blur → offset → flood → clip → merge under the source), written out
      // by hand for one measured reason: the parity gate's rasterizer
      // (librsvg 2.63.2, via sharp) IGNORES `feDropShadow`'s `in` attribute —
      // a nonexistent ref, `SourceAlpha` and a morphed result all rasterize
      // byte-identically (`.dev/tmp/fx2-dropshadow-in.mjs`). Feeding the
      // morphed silhouette through `feDropShadow` is correct in browsers
      // (Chromium honours `in`) and unmeasurable in the gate; the expansion
      // below renders identically in both (it IS what `feDropShadow` means),
      // so canvas, browser SVG and gate SVG agree three ways instead of two.
      // Without spread the shorthand stays, byte-identical to always.
      parts.push(
        morphed.step,
        `<feGaussianBlur stdDeviation="${r}" in="${morphed.from}" result="${id}-dg"/>`,
        `<feOffset dx="${x}" dy="${y}" in="${id}-dg" result="${id}-do"/>`,
        `<feFlood flood-color="${color}" flood-opacity="${opacity}" result="${id}-df"/>`,
        `<feComposite in="${id}-df" in2="${id}-do" operator="in" result="${id}-ds"/>`,
        `<feMerge result="${id}-d"><feMergeNode in="${id}-ds"/><feMergeNode in="SourceGraphic"/></feMerge>`
      );
    } else {
      parts.push(
        `<feDropShadow dx="${x}" dy="${y}" stdDeviation="${r}" flood-color="${color}" flood-opacity="${opacity}" in="${source}" result="${id}-d"/>`
      );
    }
    source = `${id}-d`;
  }

  if (bloomActiveSvg(bloom)) {
    // Bloom is the drop decomposition with zero offset, chained: each coat
    // glows the previous one's merge, which is exactly what the canvas stack
    // of `drop-shadow()` functions does. `stdDeviation` is half the blur —
    // the same mapping the drop branch uses, so one number means one softness
    // in both pipelines.
    const r = Number(bloom!.params.blur ?? 0) / 2;
    const color = String(bloom!.params.color ?? 'black');
    const opacity = Number(bloom!.params.opacity ?? 1);
    let from = source;
    for (let coat = 0; coat < bloomCoats(bloom!); coat++) {
      const result = `${id}-b${coat}`;
      parts.push(
        `<feDropShadow dx="0" dy="0" stdDeviation="${r}" flood-color="${color}" flood-opacity="${opacity}" in="${from}" result="${result}"/>`
      );
      from = result;
    }
    source = from;
  }

  if (blur) {
    const r = Number(blur.params.radius ?? 8) / 2;
    parts.push(`<feGaussianBlur stdDeviation="${r}" in="${source}"/>`);
  }

  return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">${parts.join('')}</filter>`;
};

/**
 * One shape element, filled with `paint`, carrying opacity/transform/filter.
 *
 * `offsetX/offsetY` place the shape's top-left corner. The Canvas2D compositor
 * centres a shape at `((S - w) / 2, (S - h) / 2)` (`composeLayers`), so layer
 * markup must pass that. A `clipPath` reuse must pass the same pair as the
 * content it clips — `0, 0` for the canvas background (its rect already sits at
 * the origin), the centring offsets for a layer's gradient approximation.
 */
const shapeMarkup = (
  shape: ShapeDefinition,
  paint: string,
  opacity: number,
  transform: string,
  filterAttr: string = '',
  offsetX = 0,
  offsetY = 0,
  blendMode?: BlendMode,
  /** Only the line body reads this: its end cap (the cap control). */
  lineCap: 'butt' | 'round' | 'square' = 'round',
  /** Extra attributes for the emitted element (stroke outline calls). */
  extraAttrs: string = ''
): string => {
  const t = transform ? ` transform="${transform}"` : '';
  const f = filterAttr ? ` ${filterAttr}` : '';
  const b = blendModeAttr(blendMode);
  const common = `fill="${paint}" opacity="${opacity}"${t}${f}${b}${extraAttrs}`;
  const ox = offsetX;
  const oy = offsetY;

  if (shape.kind === 'circle') {
    const r = Math.min(shape.width, shape.height) / 2;
    return `<circle cx="${ox + shape.width / 2}" cy="${oy + shape.height / 2}" r="${r}" ${common}/>\n`;
  }
  if (shape.kind === 'triangle') {
    return `<polygon points="${ox + shape.width / 2},${oy} ${ox + shape.width},${oy + shape.height} ${ox},${oy + shape.height}" ${common}/>\n`;
  }
  if (shape.kind === 'line') {
    // Closed body like the compositor's: round = the capsule it always was
    // (identical markup), butt = the flat box, square = the box extended by
    // half the thickness per end.
    if (lineCap === 'butt') {
      return `<rect x="${ox}" y="${oy}" width="${shape.width}" height="${shape.height}" ${common}/>\n`;
    }
    if (lineCap === 'square') {
      return `<rect x="${ox - shape.height / 2}" y="${oy}" width="${shape.width + shape.height}" height="${shape.height}" ${common}/>\n`;
    }
    const rx = Math.min(shape.width, shape.height) / 2;
    return `<rect x="${ox}" y="${oy}" width="${shape.width}" height="${shape.height}" rx="${rx}" ${common}/>\n`;
  }
  if (shape.kind === 'star') {
    const cx = ox + shape.width / 2;
    const cy = oy + shape.height / 2;
    const outer = Math.min(shape.width, shape.height) / 2;
    const inner = outer * (shape.innerRatio ?? 0.5);
    const count = shape.pointCount ?? 5;
    const pts: string[] = [];
    for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / count) * i - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    }
    return `<polygon points="${pts.join(' ')}" ${common}/>\n`;
  }
  // A polygon carries its own points, offset by the same origin the Canvas2D
  // `traceShapePath` adds (`x + point.x`). Without this branch it fell through
  // to the rectangle below and the SVG export drew a box where the editor drew
  // the polygon.
  if (shape.kind === 'polygon' && shape.points?.length) {
    const pts = shape.points.map((p) => `${ox + p.x},${oy + p.y}`).join(' ');
    return `<polygon points="${pts}" ${common}/>\n`;
  }

  // A squircle is a superellipse, not a rounded rectangle. It used to be written
  // as `<rect rx="width * 0.25">`, which is a different curve entirely — measured
  // against the canvas backend, that put 10,2% of pixels outside tolerance and
  // was visible side by side as a rounded rect where the editor drew a squircle.
  // The curve was already in this file for the mask; a shape now uses the same
  // one, so the two pipelines cannot disagree about where the edge is.
  if (shape.kind === 'squircle') {
    // The shared definition — the same function the canvas compositor traces —
    // so the vector and raster pipelines cannot disagree about where the edge is.
    const outline = `<path d="${superellipsePathD(shape.width, shape.height)}" ${common}/>`;
    return `<g transform="translate(${ox} ${oy})">${outline}</g>\n`;
  }

  if (shape.kind === 'rounded-rectangle' && (shape.cornerSmoothing ?? 0) > 0) {
    // Radius + smoothing — the same construction `traceSmoothRect` draws on
    // canvas (geometry/smoothCorners). The radius default mirrors the
    // compositor's `?? min * 0.18`.
    const radius = shape.cornerRadius ?? Math.min(shape.width, shape.height) * 0.18;
    const outline = `<path d="${smoothRectPathD(shape.width, shape.height, radius, shape.cornerSmoothing ?? 0)}" ${common}/>`;
    return `<g transform="translate(${ox} ${oy})">${outline}</g>\n`;
  }

  const rx = shape.cornerRadius ?? 0;
  return `<rect x="${ox}" y="${oy}" width="${shape.width}" height="${shape.height}" rx="${rx}" ${common}/>\n`;
};

/**
 * The stroke outline for a shape, with the alignment applied:
 *  - `center`: one element, the stroke straddling the edge;
 *  - `inside`: the doubled stroke clipped to the shape;
 *  - `outside`: the doubled stroke kept by a mask that hides the shape itself.
 * `defs` receives whatever clipPath/mask the alignment needs.
 */
const strokeOutline = (
  shape: ShapeDefinition,
  stroke: NonNullable<IconLayer['stroke']>,
  ox: number,
  oy: number,
  canvas: Dimensions,
  defs: string[],
  nextId: (prefix: string) => string
): string => {
  const cap = stroke.cap ?? 'butt';
  const join = stroke.join ?? 'miter';
  const color = toRgba(stroke.color, 1);
  const outline = (width: number) =>
    shapeMarkup(
      shape,
      'none',
      1,
      '',
      '',
      ox,
      oy,
      undefined,
      'round',
      ` stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="${join}" stroke-miterlimit="4"`
    );

  if (stroke.alignment === 'center') return outline(stroke.width);

  if (stroke.alignment === 'inside') {
    const clipId = nextId(`stroke-in-${shape.kind}`);
    defs.push(`<clipPath id="${clipId}">${shapeMarkup(shape, 'black', 1, '', '', ox, oy)}</clipPath>`);
    return `<g clip-path="url(#${clipId})">${outline(stroke.width * 2)}</g>`;
  }

  const maskId = nextId(`stroke-out-${shape.kind}`);
  defs.push(
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${canvas.width}" height="${canvas.height}">` +
      `<rect x="0" y="0" width="${canvas.width}" height="${canvas.height}" fill="white"/>` +
      `${shapeMarkup(shape, 'black', 1, '', '', ox, oy)}` +
      `</mask>`
  );
  return `<g mask="url(#${maskId})">${outline(stroke.width * 2)}</g>`;
};

/**
 * Approximate an angular (conic) or diamond gradient with primitive shapes.
 * Used because SVG has no conic gradient; the caller clips the result to the
 * shape (or the canvas rect).
 *
 * `offsetX/offsetY` translate the approximation into the caller's coordinate
 * space. Layer markup passes the compositor's centring offsets — the same pair
 * `shapeMarkup` gets — while the canvas background passes none, because its
 * rect already sits at the origin.
 */
const approximationMarkup = (
  fill: GradientFill,
  shape: ShapeDefinition,
  offsetX = 0,
  offsetY = 0,
  steps = 180
): string => {
  const w = shape.width;
  const h = shape.height;
  const cx = offsetX + w * ((fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient' ? fill.centerX : 0.5) ?? 0.5);
  const cy = offsetY + h * ((fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient' ? fill.centerY : 0.5) ?? 0.5);

  if (fill.kind === 'diamond-gradient') {
    const reach = Math.max(w, h) * (fill.radius ?? 0.5);
    let out = `<rect x="${offsetX}" y="${offsetY}" width="${w}" height="${h}" fill="${sampleStops(fill.stops, 1)}"/>`;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = reach * (1 - t);
      out += `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${sampleStops(fill.stops, 1 - t)}"/>`;
    }
    return out;
  }

  const radius = Math.hypot(w, h);
  const start = conicStartRadians(fill.kind === 'angular-gradient' ? fill.angle ?? 0 : 0);
  let out = '';
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const a0 = start + t0 * Math.PI * 2;
    const a1 = start + t1 * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radius;
    const y0 = cy + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const y1 = cy + Math.sin(a1) * radius;
    out += `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z" fill="${sampleStops(fill.stops, (t0 + t1) / 2)}"/>`;
  }
  return out;
};

export interface RenderSvgOptions {
  /**
   * `canvas` (the default) paints the project background, matching what the
   * editor shows. `transparent` omits it and keeps transparency — what the
   * export path asks for, for the same reason as `RenderOptions.background`.
   */
  background?: RenderBackground;
  /**
   * Clip the document to this outline, mirroring the raster path. `'none'` (and
   * absent) keeps it full bleed, which is what every caller that never asked
   * produced before.
   */
  mask?: CanvasMaskShape | 'none';
  /**
   * Natural dimensions per layer id for raster (non-SVG) image layers, so they
   * can be embedded as `data:` URIs. Without an entry the image
   * layer is omitted from the SVG — and a warning is reported unless
   * `skipImages` is set (opt-out per artifact).
   */
  imageSizes?: ReadonlyMap<string, { width: number; height: number }>;
  /** Omit unsized image layers silently (legacy/opt-out behaviour). Default: warn. */
  skipImages?: boolean;
  /** Alert when an embedded base64 image exceeds this byte threshold. */
  maxEmbeddedImageBytes?: number;
  /**
   * Requested pixel size of the artifact (e.g. a `web-svg` preset asks for
   * 1024). Only the root `width`/`height` change — the `viewBox` stays in canvas
   * units, which is what keeps the geometry identical while the document scales.
   * Omitted, the document renders at the canvas size.
   */
  size?: number;
  /**
   * Requested pixel height of the artifact. Same additive contract as the
   * model: absent means square (`height = size`).
   */
  height?: number;
}

export interface RenderSvgResult {
  svg: string;
  warnings: string[];
}

/**
 * Legacy synchronous export. Raster image layers are omitted (the pre-embed
 * behaviour, unchanged); use `renderToSvgWithOptions` to embed them.
 */
export const renderToSvg = (project: IconCoreProject, variant: IconVariant): string =>
  renderToSvgWithOptions(project, variant, { skipImages: true }).svg;

export const renderToSvgWithOptions = (
  project: IconCoreProject,
  variant: IconVariant,
  options: RenderSvgOptions = {}
): RenderSvgResult => {
  const warnings: string[] = [];
  const { imageSizes, skipImages = false, maxEmbeddedImageBytes } = options;

  const canvas = resolveSize(project.canvas);
  const bg =
    options.background === 'transparent'
      ? ({ kind: 'none' } as const)
      : (project.variants[variant]?.canvas?.background ?? project.canvas.background);

  const defs: string[] = [];
  let idSeq = 0;
  const nextId = (prefix: string): string => `${prefix}-${idSeq++}`;

  // --- background ---------------------------------------------------------
  let bgMarkup = '';
  if (bg.kind !== 'none') {
    const rect: ShapeDefinition = { kind: 'rectangle', width: canvas.width, height: canvas.height };
    if (bg.kind === 'angular-gradient' || bg.kind === 'diamond-gradient') {
      const clipId = nextId('bg-clip');
      defs.push(`<clipPath id="${clipId}"><rect width="${canvas.width}" height="${canvas.height}"/></clipPath>`);
      bgMarkup = `<g clip-path="url(#${clipId})">${approximationMarkup(bg, rect)}</g>\n`;
    } else {
      const paint = paintFor(bg, nextId('bg'));
      if (paint) {
        if (paint.defs) defs.push(paint.defs);
        bgMarkup = `<rect width="${canvas.width}" height="${canvas.height}" fill="${paint.paint}"/>\n`;
      }
    }
  }

  // --- layers -------------------------------------------------------------
  // The background handle is a UI affordance for `canvas.background`; it never
  // produces pixels.
  const visible = project.layers
    .map((layer) => resolveLayer(layer, variant))
    .filter((l) => l.visible && l.role !== 'background')
    .sort((a, b) => a.zIndex - b.zIndex);

  let svgLayers = '';

  // The below-stack accumulator for backdrop blur (Tier 2, fatia 2.1): every
  // finished layer's own markup lands here, starting with the background, so
  // a backdrop-blurred layer can re-emit everything beneath it — blurred and
  // clipped to its own footprint — before its own paint. See the decision in
  // the backdrop block inside the loop.
  const below: string[] = [bgMarkup];

  /**
   * One layer's own markup, without anything below it.
   *
   * Extracted so the backdrop block can account each layer into `below`
   * without touching thirteen `continue` exits: every exit returns the
   * markup built so far (empty for a skipped layer), and the loop appends
   * and records it in one place. Emitted bytes are unchanged — same
   * appends, same order, same ids per document without backdrop blur.
   */
  /**
   * Footprint clip for blur/glass/noise coats: the shape outline, or the
   * layer box for shapeless layers (sized when resolved, full canvas
   * otherwise with a warning — degenerate but bounded). Returns the clip id.
   * Shared by the base and the noise coat, which live in sibling functions.
   */
  const footprintClipMarkup = (layer: IconLayer, tag: string, warnLabel: string): string => {
    const clipId = nextId(`${tag}-clip-${layer.id}`);
    const footprint = layer.source.shape;
    if (footprint) {
      const ox = (canvas.width - footprint.width) / 2;
      const oy = (canvas.height - footprint.height) / 2;
      defs.push(`<clipPath id="${clipId}">${shapeMarkup(footprint, 'black', 1, '', '', ox, oy)}</clipPath>`);
    } else {
      const natural = imageSizes?.get(layer.id);
      const box = layerBaseRect({ source: layer.source }, canvas, natural);
      defs.push(
        `<clipPath id="${clipId}"><rect x="${box.cx - box.w / 2}" y="${box.cy - box.h / 2}" ` +
        `width="${box.w}" height="${box.h}"/></clipPath>`
      );
      if (!natural) {
        warnings.push(
          `Layer "${layer.name}" uses ${warnLabel} without a shape or resolvable image size: the SVG covers the whole below-stack.`
        );
      }
    }
    return clipId;
  };

  const renderLayerBase = (layer: IconLayer, transformAttr: string): string => {
    let own = '';
    const opacity = layer.opacity;

    // Build the SVG filter for this layer: the layer effects (shadows/blur)
    // take precedence, falling back to the image adjustments for image layers.
    const filterId = nextId(`filter-${layer.id}`);
    const effectsFilter = effectFilterMarkup(layer.effects, filterId);
    const filterMarkup = effectsFilter || imageFilterToSvgFilter(layer.imageFilter, filterId);
    if (filterMarkup) defs.push(filterMarkup);
    const filterAttr = filterMarkup ? ` filter="url(#${filterId})"` : '';

    // The below-stack blurred inside the footprint. The transform wraps the
    // clip, not the content: like the canvas (clip under the layer
    // transform, snapshot drawn untransformed), the clip moves with the layer
    // while the below-stack stays where it was.
    const blurredBelowGroup = (tag: string, radius: number): string => {
      const clipId = footprintClipMarkup(layer, tag, 'backdrop blur');
      const blurId = nextId(`${tag}-blur-${layer.id}`);
      defs.push(
        `<filter id="${blurId}" x="-60%" y="-60%" width="220%" height="220%">` +
        `<feGaussianBlur stdDeviation="${radius}"/></filter>`
      );
      return (
        `<g transform="${transformAttr}"><g clip-path="url(#${clipId})" filter="url(#${blurId})">` +
        `${below.join('')}</g></g>\n`
      );
    };

    /** Clamp a 0..1 param without importing canvas colour maths for one call. */
    const unit = (value: number): number => Math.min(1, Math.max(0, value));

    /**
     * One glass layer's coats: blurred-below, tint, inner edge, frost.
     * Mirrors `paintGlass` coat for coat; an off coat is skipped.
     */
    const glassGroupMarkup = (effect: LayerEffect, outerTransform: string): string => {
      const clipId = footprintClipMarkup(layer, 'glass', 'glass');
      const footprint = layer.source.shape;
      let inner = '';

      const blurRadius = Number(effect.params.blurRadius ?? 0);
      if (blurRadius > 0) {
        const blurId = nextId(`glass-blur-${layer.id}`);
        defs.push(
          `<filter id="${blurId}" x="-60%" y="-60%" width="220%" height="220%">` +
          `<feGaussianBlur stdDeviation="${blurRadius}"/></filter>`
        );
        inner += `<g clip-path="url(#${clipId})" filter="url(#${blurId})">${below.join('')}</g>`;
      }

      const tintOpacity = unit(Number(effect.params.tintOpacity ?? 0));
      if (tintOpacity > 0) {
        const paint = toRgba(String(effect.params.tint ?? '#ffffff'), tintOpacity);
        if (footprint) {
          const ox = (canvas.width - footprint.width) / 2;
          const oy = (canvas.height - footprint.height) / 2;
          inner += shapeMarkup(footprint, paint, 1, '', '', ox, oy);
        } else {
          const box = layerBaseRect({ source: layer.source }, canvas, imageSizes?.get(layer.id));
          inner +=
            `<rect x="${box.cx - box.w / 2}" y="${box.cy - box.h / 2}" ` +
            `width="${box.w}" height="${box.h}" fill="${paint}"/>\n`;
        }
      }

      const edge = unit(Number(effect.params.edgeHighlight ?? 0));
      if (edge > 0 && footprint) {
        const ox = (canvas.width - footprint.width) / 2;
        const oy = (canvas.height - footprint.height) / 2;
        // 6px centred stroke clipped to the footprint = 3px inner, the same
        // coat `paintGlass` strokes on canvas (`GLASS_EDGE_PX * 2`).
        inner += `<g clip-path="url(#${clipId})">` +
          shapeMarkup(
            footprint,
            'none',
            1,
            '',
            '',
            ox,
            oy,
            undefined,
            'round',
            ` stroke="${toRgba('#ffffff', edge)}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"`
          ) +
          `</g>`;
      }

      const frost = unit(Number(effect.params.frost ?? 0));
      if (frost > 0) {
        const noiseId = nextId(`glass-noise-${layer.id}`);
        // Fixed seed, fractal noise, desaturated: the vector cousin of the
        // canvas grain tile (`paintGrainTile`, same fixed-seed contract).
        // Fields differ per engine, so both sides stay subtle and the parity
        // threshold absorbs the texture — what the gate pins is that the
        // coat exists and is bounded, not the grain positions.
        defs.push(
          `<filter id="${noiseId}" x="0%" y="0%" width="100%" height="100%">` +
          `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" stitchTiles="stitch"/>` +
          `<feColorMatrix type="saturate" values="0"/></filter>`
        );
        const box = footprint
          ? {
              x: (canvas.width - footprint.width) / 2,
              y: (canvas.height - footprint.height) / 2,
              w: footprint.width,
              h: footprint.height
            }
          : (() => {
              const b = layerBaseRect({ source: layer.source }, canvas, imageSizes?.get(layer.id));
              return { x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h };
            })();
        inner += `<g clip-path="url(#${clipId})">` +
          `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" ` +
          `filter="url(#${noiseId})" opacity="${(frost * FROST_SVG_PEAK).toFixed(4)}"/>\n` +
          `</g>`;
      }

      return `<g transform="${outerTransform}">${inner}</g>\n`;
    };

    //
    // SPIKE DECISION (fatia 2.1, recorded here because this is where it
    // lives): SVG has no backdrop primitive, and the two candidate
    // strategies were (a) rasterize-the-below-stack into an embedded
    // `data:` image, or (b) re-emit the below-stack as vector markup under
    // a blur + clip. (a) is impossible synchronously — `renderToSvg` cannot
    // rasterize, and threading a raster through every exporter breaks "no
    // exporter owns effect logic". (b) is pure markup, deterministic, works
    // in every SVG reader (no `backdrop-filter` support gamble), and nests
    // correctly when several layers blur (each sees everything below it).
    // Cost: the below-stack markup repeats per blurred layer — linear in
    // layers × blurred layers, trivial for icons.
    //
    // Mapping: canvas blurs the snapshot with `blur(radius px)`, and the
    // kernel proof (`.dev/tmp/fx2-kernel-proof.mjs`) measured that 1:1
    // against `feGaussianBlur stdDeviation=radius` — NOT the `/2` the
    // Tier-1 surface-blur path uses (which disagrees with its canvas by 2×
    // and ships no parity fixture to notice — see IC-N51, left untouched).
    // A non-positive radius is off: zero markup, like every disabled effect.
    const backdrop = (layer.effects ?? []).find((effect) => effect.kind === 'backdrop-blur' && effect.enabled);
    const backdropRadius = backdrop ? Number(backdrop.params.radius ?? 0) : 0;
    if (backdrop && backdropRadius > 0) {
      own += blurredBelowGroup('backdrop', backdropRadius);
    }

    // Glass v1 (Tier 2, fatia 2.2): the same blurred-below plus tint, inner
    // edge and frost — one footprint clip shared by every coat, like the
    // canvas (see `paintGlass` in `composeLayers.ts`). A coat at zero is
    // skipped; an enabled entry with every param at zero emits nothing.
    const glass = (layer.effects ?? []).find((effect) => effect.kind === 'glass');
    if (glass && glassActive(glass)) {
      own += glassGroupMarkup(glass, transformAttr);
    }

    if (layer.kind === 'text' && layer.text) {
      const fill = layer.fill;
      if (!fill || fill.kind === 'none') return own;
      let paint: string;
      if (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient') {
        paint = sampleStops(fill.stops, 0);
      } else {
        const resolved = paintFor(fill, nextId(`text-${layer.id}`));
        if (!resolved) return own;
        if (resolved.defs) defs.push(resolved.defs);
        paint = resolved.paint;
      }
// `IC63/2` — a mesma função de geometria que o canvas consome
      // (`resolveTextPlacement`), traduzida para o vocabulário do SVG: `text-anchor`
      // em vez de `ctx.textAlign`. Um `text-anchor="start"` no ponto errado, ou um
      // `font-style` esquecido, é a divergência que a fixture de texto agora mede.
      //
      // `font-style` é atributo **separado** aqui, ao contrário do canvas: a assinatura
      // `ctx.font` é posicional (`[italic] [weight] size family`) e o SVG não tem
      // assinatura nenhuma. Omitir o atributo quando não é itálico, em vez de escrever
      // `font-style="normal"`, mantém o SVG exportado menor — e `normal` é o padrão.
      //
      // `content` e `fontFamily` vêm do `.iconcore.json` da pessoa e são escapados. São as
      // **duas** interpolações deste arquivo que recebem dado do usuário — as demais são
      // números e valores derivados (`fontSize`, `fontWeight`, `paint`, offsets). Sem o
      // escape, `AT&T` produz XML malformado que nenhum leitor abre, e um nome de família
      // com aspas fecha o atributo. Ver `escapeXml.ts` para o porquê de uma função só.
      const place = resolveTextPlacement(canvas, layer.source.shape, layer.text.textAlign);
      const styleAttr = isItalic(layer.text.fontStyle) ? ' font-style="italic"' : '';
      // `xml:space="preserve"` é obrigatório aqui, e não é cosmético.
      //
      // SVG 1.1 define `xml:space="default"` como: remover quebras de linha, converter
      // tabs, remover espaços das pontas e **consolidar espaços contíguos em um**. O canvas
      // não faz nada disso. Sem o atributo, `"A  B"` sai com um espaço no SVG e dois no
      // canvas — e as fixtures de texto eram `"Icon"` e `"Wg"`, que não têm espaço
      // nenhum, pelo mesmo motivo pelo qual nunca pegaram o `&`.
      //
      // Por que `xml:space` e não `white-space: pre`: o SVG 2 substituiu `xml:space` por
      // `white-space`, mas o **librsvg não implementa o `white-space` do SVG 2** — a
      // documentação dele diz isso textualmente. `xml:space` é hoje a única forma que
      // funciona nos dois rasterizadores, e o Illustrator emite em todo SVG que exporta.
      own += `<text x="${place.x}" y="${place.y}" text-anchor="${place.svgAnchor}" dominant-baseline="middle" font-family="${escapeXml(layer.text.fontFamily)}" font-size="${layer.text.fontSize}" font-weight="${layer.text.fontWeight}"${styleAttr} fill="${paint}" opacity="${opacity}" transform="${transformAttr}"${filterAttr} xml:space="preserve">${escapeXml(layer.text.content)}</text>\n`;
      return own;
    }

    if (layer.source.type === 'inline' && layer.source.data && layer.source.mimeType === 'image/svg+xml') {
      try {
        const svgContent = atob(layer.source.data);
        /**
         * `IC63/1b` — the color override, applied **here**, before anything else.
         *
         * This is the SVG half of a two-pipeline change. The canvas half lives in
         * `composeLayers.ts` and calls the same pure function, which is the whole point:
         * one function, two callers, so the two renderings agree **by construction**
         * rather than by a fixture someone has to remember to add. Writing the rewrite
         * twice is how `IC-N28` happened — two pipelines that nobody compared.
         *
         * Before namespacing, deliberately: ids inside the document are not colors, and
         * the override only rewrites paint values.
         */
        const recolored = applySvgPaintOverrides(svgContent, layer.svgPaintOverrides ?? {});
        // Namespace before anything else: an imported document carries its own
        // short ids, and two layers defining the same one would make every
        // `url(#…)` resolve to whichever definition came first.
        const scoped = namespaceSvgIds(recolored, `l${layer.id}`);
        const natural = parseSvgIntrinsicSize(scoped);
        if (!natural) {
          // No intrinsic size to align with: embed as-is (previous behaviour).
          own += `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>${scoped}</g>\n`;
          return own;
        }
        // The Canvas2D backend draws the asset into the layer rectangle, so the
        // SVG export must place it in the same rectangle: pin the document's
        // viewport to its intrinsic size, then map that onto the rect. Without
        // this, PNG and SVG exports of the same project disagreed.
        const layerRect = layerBaseRect({ source: layer.source }, canvas, natural);
        const placement =
          `translate(${layerRect.cx - layerRect.w / 2},${layerRect.cy - layerRect.h / 2}) ` +
          `scale(${layerRect.w / natural.width},${layerRect.h / natural.height})`;
        own +=
          `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>` +
          `<g transform="${placement}">${setSvgViewport(scoped, natural.width, natural.height)}</g>` +
          `</g>\n`;
      } catch {
        // Skip layers with invalid base64
      }
      return own;
    }

    // Raster image layer (inline base64, non-SVG): embed as a data: URI when the
    // caller resolved its natural size. Without a size it is omitted
    // and a warning is reported unless the artifact opted out via `skipImages`.
    if (layer.source.data && layer.source.mimeType && layer.source.mimeType !== 'image/svg+xml') {
      const natural = imageSizes?.get(layer.id);
      if (natural && !skipImages) {
        const layerRect = layerBaseRect({ source: layer.source }, canvas, natural);
        const placement =
          `translate(${layerRect.cx - layerRect.w / 2},${layerRect.cy - layerRect.h / 2}) ` +
          `scale(${layerRect.w / natural.width},${layerRect.h / natural.height})`;
        const dataUri = `data:${layer.source.mimeType};base64,${layer.source.data}`;
        own +=
          `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>` +
          `<image x="0" y="0" width="${natural.width}" height="${natural.height}" href="${dataUri}" transform="${placement}"/>` +
          `</g>\n`;
        if (maxEmbeddedImageBytes !== undefined) {
          const approxBytes = Math.ceil(layer.source.data.length * 0.75);
          if (approxBytes > maxEmbeddedImageBytes) {
            warnings.push(
              `Image layer "${layer.name}" embeds ~${approxBytes} bytes as base64 in the SVG (limit: ${maxEmbeddedImageBytes}).`
            );
          }
        }
      } else if (!skipImages) {
        warnings.push(
          `Image layer "${layer.name}" could not be embedded in the SVG (no resolvable size) and was omitted.`
        );
      }
      return own;
    }

    const shape = layer.source.shape;
    if (!shape) return own;

    const fill = layer.fill;
    const stroke = layer.stroke && layer.stroke.width > 0 ? layer.stroke : undefined;
    // A shape with no paint (no fill and no stroke) is transparent.
    if ((!fill || fill.kind === 'none') && !stroke) return own;

    const ox = (canvas.width - shape.width) / 2;
    const oy = (canvas.height - shape.height) / 2;

    // The line's body carries its cap control (default: the round capsule it
    // always was — identical markup for every existing project).
    if (shape.kind === 'line') {
      if (fill && (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient')) {
        own += shapeMarkup(
          shape,
          sampleStops(fill.stops, 0),
          opacity,
          transformAttr,
          filterAttr,
          ox,
          oy,
          layer.blendMode,
          stroke?.cap ?? 'round'
        );
      } else if (fill && fill.kind !== 'none') {
        const resolved = paintFor(fill, nextId(`line-${layer.id}`));
        if (!resolved) return own;
        if (resolved.defs) defs.push(resolved.defs);
        own += shapeMarkup(
          shape,
          resolved.paint,
          opacity,
          transformAttr,
          filterAttr,
          ox,
          oy,
          layer.blendMode,
          stroke?.cap ?? 'round'
        );
      }
      return own;
    }

    if (fill && (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient')) {
      const clipId = nextId(`clip-${layer.id}`);
      // Clip and approximation share one coordinate space, centred like the
      // compositor: the same `((S - w) / 2, (S - h) / 2)` offsets every other
      // branch passes. Without them the whole group sat at the local origin
      // and the artwork exported shifted by `-ox * scale`.
      defs.push(`<clipPath id="${clipId}">${shapeMarkup(shape, '#000000', 1, '', '', ox, oy)}</clipPath>`);
      // The approximation stands in for a conic/diamond gradient, and it inherits
      // the layer's blend mode too — otherwise a layer with both would lose the
      // blend in SVG while keeping it on canvas.
      own += `<g opacity="${opacity}" transform="${transformAttr}" clip-path="url(#${clipId})"${filterAttr}${blendModeAttr(layer.blendMode)}>${approximationMarkup(fill, shape, ox, oy)}</g>\n`;
      if (stroke) {
        own += `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}${blendModeAttr(layer.blendMode)}>${strokeOutline(shape, stroke, ox, oy, canvas, defs, nextId)}</g>\n`;
      }
      return own;
    }

    const resolved = fill && fill.kind !== 'none' ? paintFor(fill, nextId(`fill-${layer.id}`)) : null;
    if (fill && fill.kind !== 'none' && !resolved) return own;
    if (resolved?.defs) defs.push(resolved.defs);
    // Centred like the Canvas2D compositor: `((S - w) / 2, (S - h) / 2)`.
    const fillMarkup = resolved
      ? shapeMarkup(shape, resolved.paint, opacity, transformAttr, filterAttr, ox, oy, layer.blendMode)
      : '';

    if (!stroke) {
      // No stroke: the exact markup this pipeline always produced.
      own += fillMarkup;
      return own;
    }

    // Stroke present: one group carries the layer's opacity/transform/filter/
    // blend so fill + outline composite exactly like the canvas stack — two
    // siblings with their own opacity would double it where they overlap.
    const innerFill = resolved ? shapeMarkup(shape, resolved.paint, 1, '', '', ox, oy) : '';
    own +=
      `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}${blendModeAttr(layer.blendMode)}>` +
      `${innerFill}${strokeOutline(shape, stroke, ox, oy, canvas, defs, nextId)}` +
      `</g>\n`;
    return own;
  };

  /**
   * The noise-grain coat, AFTER the layer's own paint.
   *
   * Grain is an overlay, not a behind-effect: emitting it inside the base
   * (before the fill) buries it under the layer's own opaque paint — measured
   * as 0.0 deviation in sharp while the isolated markup grained fine. The
   * loop appends this after the base, so it sits on top in both pipelines
   * (the canvas paints it last in `paintLayerContent` for the same reason).
   * The coat joins `below`, so a later backdrop-blur sees grained layers —
   * exactly what the canvas snapshot sees.
   */
  const renderNoiseCoat = (layer: IconLayer, transformAttr: string): string => {
    const noise = (layer.effects ?? []).find((effect) => effect.kind === 'noise-grain');
    if (!noiseActive(noise)) return '';
    const amount = Math.min(1, Math.max(0, Number(noise!.params.amount ?? 0)));
    const cell = noiseSizePx(noise!);
    const mono = noise!.params.monochrome === undefined ? true : Boolean(noise!.params.monochrome);
    const noiseId = nextId(`noise-${layer.id}`);
    defs.push(
      `<filter id="${noiseId}" x="0%" y="0%" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${(0.9 / cell).toFixed(3)}" numOctaves="2" seed="3" stitchTiles="stitch"/>` +
      (mono ? `<feColorMatrix type="saturate" values="0"/>` : '') +
      `</filter>`
    );
    const clipId = footprintClipMarkup(layer, 'noise', 'noise grain');
    const footprint = layer.source.shape;
    const box = footprint
      ? {
          x: (canvas.width - footprint.width) / 2,
          y: (canvas.height - footprint.height) / 2,
          w: footprint.width,
          h: footprint.height
        }
      : (() => {
          const b = layerBaseRect({ source: layer.source }, canvas, imageSizes?.get(layer.id));
          return { x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h };
        })();
    return `<g transform="${transformAttr}"><g clip-path="url(#${clipId})">` +
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" ` +
      `filter="url(#${noiseId})" opacity="${(amount * NOISE_SVG_PEAK).toFixed(4)}"/>\n` +
      `</g></g>`;
  };

  for (const layer of visible) {
    const transformAttr = layerTransformAttr(canvas, layer.transform);
    const own = renderLayerBase(layer, transformAttr) + renderNoiseCoat(layer, transformAttr);
    svgLayers += own;
    below.push(own);
  }

  const defsBlock = () => (defs.length > 0 ? `  <defs>\n    ${defs.join('\n    ')}\n  </defs>\n` : '');

  // `size` scales the document without moving anything: the viewBox keeps
  // describing the canvas in canvas units, so the geometry a reader measures is
  // the same one the compositor produced.
  // Output document size: the artifact's requested pair, or the canvas pair.
  // `size` alone stays square (the only shape that existed before non-square).
  const requestedWidth = options.size && options.size > 0 ? options.size : undefined;
  const requestedHeight = options.height && options.height > 0 ? options.height : undefined;
  const output = resolveSize({
    size: requestedWidth ?? canvas.width,
    height: requestedHeight ?? (requestedWidth === undefined ? canvas.height : undefined)
  });
  // The export mirror, matching the raster path: when the caller asks for a
  // mask, the whole composition is wrapped in a clip so the file has the same
  // outline the canvas frame shows. `'none'` leaves the document untouched,
  // which is what every caller that never asked produced before.
  let clipOpen = '';
  let clipClose = '';
  if (options.mask && options.mask !== 'none') {
    const clipId = nextId('canvas-clip');
    const { width, height } = canvas;
    const radius = Math.min(
      resolveMaskRadius(project.canvas),
      Math.min(width, height) / 2
    );
    const outline =
      options.mask === 'circle'
        ? `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${Math.min(width, height) / 2}" ry="${Math.min(width, height) / 2}"/>`
        : options.mask === 'squircle'
          ? squirclePath(Math.min(width, height))
          : `<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}"/>`;
    defs.push(`<clipPath id="${clipId}">${outline}</clipPath>`);
    clipOpen = `<g clip-path="url(#${clipId})">`;
    clipClose = '</g>';
  }

  // Note on `isolation: an earlier version emitted `isolation:isolate` here, on
  // the reasoning that `mix-blend-mode` blends against the backdrop and would
  // reach past the artwork. Measured, that is not what happens — the `<svg>` root
  // establishes its own stacking context, so the backdrop inside the document is
  // already the document. Rendering the same blend over a black page and over a
  // red page produced byte-identical pixels with and without the attribute.
  //
  // It was removed rather than kept as a harmless extra, because an attribute
  // that claims to prevent something which cannot happen is a comment waiting to
  // mislead whoever reads this next.

  // A function, not a string: the canvas clip below pushes into `defs` *after*
  // this point, so a snapshot taken here would omit the very `<clipPath>` the
  // `clip-path` attribute points at. That was the bug — the exported SVG
  // referenced `url(#canvas-clip-N)` with no such id in the document, so the
  // masked export rendered unclipped. Fixed by evaluating `defs` at the last
  // possible moment.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${output.width}" height="${output.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
${defsBlock()}${clipOpen}${bgMarkup}${svgLayers}${clipClose}
</svg>`;

  return { svg, warnings };
};
