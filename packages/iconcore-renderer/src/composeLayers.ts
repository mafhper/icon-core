import type { CanvasMaskShape, Dimensions, Fill, IconLayer, IconVariant, LayerEffect, ShapeKind } from '@iconcore/shared';
import { imageFilterToCss, resolveMaskRadius } from '@iconcore/shared';
import type { RenderBackend, RenderContext, ResolvedLayer } from './types';
import { traceSuperellipse } from './geometry/superellipse';
import { traceSmoothRect } from './geometry/smoothCorners';
import { toRgba, clamp01 } from './color';
import { layerBaseRect } from './geometry';
import { clipSquircle } from './masks/applyMask';
import { applySvgPaintOverrides } from './svgPaint';
import { canvasFontShorthand, resolveTextPlacement } from './textLayout';

/**
 * Spread (CSS `box-shadow` fourth length) of a shadow effect. Additive and
 * optional: absent means `0`, which is exactly the shadow every existing
 * project paints — so the fast `ctx.shadow*` path below stays byte-identical
 * for them and only a non-zero spread takes the offscreen route.
 */
const shadowSpread = (effect: LayerEffect): number => Number(effect.params.spread ?? 0);

/**
 * Binary dilate/erode of a canvas's alpha channel, separable box kernel.
 *
 * Canvas2D has no shadow spread (`shadowBlur` only softens), so spread is a
 * contour operation before the blur: grow the silhouette (`dilate`) for a
 * positive spread, shrink it (`erode`) for a negative one — the same order
 * the SVG pipeline uses (`feMorphology` before `feGaussianBlur`), which is
 * what keeps the two renderings in agreement.
 *
 * Only alpha moves: the colour is uniform by construction (the caller tints
 * through `source-in` first), so RGB is left alone. Deterministic — a pure
 * pixel loop, no GPU rounding — and cheap: two separable passes, ~2·W·H·(2r+1)
 * operations, ~5M at 256px/radius 20.
 */
const morphAlphaChannel = (
  native: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
  mode: 'dilate' | 'erode'
): void => {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return;
  const image = native.getImageData(0, 0, width, height);
  const { data } = image;
  const row = new Uint8ClampedArray(width);
  const col = new Uint8ClampedArray(height);
  const pick = mode === 'dilate'
    ? (a: number, b: number) => Math.max(a, b)
    : (a: number, b: number) => Math.min(a, b);
  const seed = mode === 'dilate' ? 0 : 255;

  // Horizontal pass, read from `data`, staged through `row`.
  const afterH = new Uint8ClampedArray(data.length);
  afterH.set(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = seed;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        acc = pick(acc, data[(y * width + xx) * 4 + 3]);
      }
      row[x] = acc;
    }
    for (let x = 0; x < width; x++) afterH[(y * width + x) * 4 + 3] = row[x];
  }
  // Vertical pass, read from `afterH`, written back into `data`.
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let acc = seed;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        acc = pick(acc, afterH[(yy * width + x) * 4 + 3]);
      }
      col[y] = acc;
    }
    for (let y = 0; y < height; y++) data[(y * width + x) * 4 + 3] = col[y];
  }
  native.putImageData(image, 0, 0);
};

const resolveLayerForVariant = (
  layer: IconLayer,
  variant: IconVariant
): ResolvedLayer => {
  const overrides = layer.variantOverrides?.[variant];
  return {
    ...layer,
    ...overrides,
    resolvedFill: overrides?.fill ?? layer.fill,
    resolvedStroke: overrides?.stroke ?? layer.stroke,
    resolvedOpacity: overrides?.opacity ?? layer.opacity,
    resolvedVisible: overrides?.visible ?? layer.visible,
    resolvedBlendMode: overrides?.blendMode ?? layer.blendMode ?? 'normal',
    resolvedSource: overrides?.source ? { ...layer.source, ...overrides.source } : layer.source,
    resolvedTransform: overrides?.transform ? { ...layer.transform, ...overrides.transform } : layer.transform,
    resolvedText: overrides?.text ? { ...layer.text, ...overrides.text } as IconLayer['text'] : layer.text,
    resolvedEffects: overrides?.effects ?? layer.effects,
    // Merged, not replaced: a variant that recolors one paint keeps the layer's others.
    resolvedSvgPaintOverrides:
      overrides?.svgPaintOverrides || layer.svgPaintOverrides
        ? { ...layer.svgPaintOverrides, ...overrides?.svgPaintOverrides }
        : undefined
  };
};

const addShapeSubpath = (
  native: CanvasRenderingContext2D,
  shape: NonNullable<IconLayer['source']['shape']>,
  x: number,
  y: number,
  /** Only the line shape reads this: its body's end cap. */
  lineCap: 'butt' | 'round' | 'square' = 'round'
): void => {
  const { width, height } = shape;

  if (shape.kind === 'circle') {
    native.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  } else if (shape.kind === 'rounded-rectangle') {
    const radius = shape.cornerRadius ?? Math.min(width, height) * 0.18;
    const smoothing = shape.cornerSmoothing ?? 0;
    if (smoothing > 0) {
      // The second corner level: radius + smoothing, the same construction the
      // SVG `d` uses (geometry/smoothCorners) — one curve, two pipelines.
      traceSmoothRect(native, x, y, width, height, radius, smoothing);
      native.closePath();
      return;
    }
    native.roundRect(x, y, width, height, radius);
  } else if (shape.kind === 'squircle') {
    // The one definition, shared with the SVG pipeline and with the mask in
    // `backends/canvas.ts`. This branch used to use `min(width, height) * 0.22`
    // on both axes with control points at the midpoints, while the mask used
    // `width * (1 - 0.6) / 2` for both — two curves for one word, which is how
    // the canvas and the SVG export drifted apart (measured: 10,2% of pixels
    // outside tolerance, visible as a rounded rect in SVG).
    traceSuperellipse(native, x, y, width, height);
  } else if (shape.kind === 'triangle') {
    native.moveTo(x + width / 2, y);
    native.lineTo(x + width, y + height);
    native.lineTo(x, y + height);
  } else if (shape.kind === 'line') {
    // The line's body is a closed capsule whose end shape IS the cap control:
    // round (the capsule it always was), butt (plain box) or square (the box
    // extended by half the thickness on each end). Closed on purpose — it keeps
    // gradient fills and the worker backend working exactly like every shape.
    if (lineCap === 'butt') {
      native.rect(x, y, width, height);
    } else if (lineCap === 'square') {
      native.rect(x - height / 2, y, width + height, height);
    } else {
      native.roundRect(x, y, width, height, Math.min(width, height) / 2);
    }
  } else if (shape.kind === 'star') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outer = Math.min(width, height) / 2;
    const inner = outer * (shape.innerRatio ?? 0.5);
    const count = shape.pointCount ?? 5;
    for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / count) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) native.moveTo(px, py);
      else native.lineTo(px, py);
    }
  } else if (shape.kind === 'polygon' && shape.points?.length) {
    native.moveTo(x + shape.points[0].x, y + shape.points[0].y);
    for (const point of shape.points.slice(1)) {
      native.lineTo(x + point.x, y + point.y);
    }
  } else {
    native.rect(x, y, width, height);
  }

  native.closePath();
};

const traceShapePath = (
  native: CanvasRenderingContext2D,
  shape: NonNullable<IconLayer['source']['shape']>,
  x: number,
  y: number,
  lineCap: 'butt' | 'round' | 'square' = 'round'
): void => {
  native.beginPath();
  addShapeSubpath(native, shape, x, y, lineCap);
};

/**
 * Whether a classic (spread-less) outer shadow has to be pre-rendered instead
 * of riding the content draws.
 *
 * `paintLayerContent` clips a filled shape to its own outline so the `fillRect`
 * behind a gradient stays inside it. A `ctx.shadow*` set on that same context
 * is clipped by the same clip: everything the shadow casts outside the shape
 * never reaches the page, while the SVG pipeline (`feDropShadow`, unclipped)
 * paints it. A filled shape with the offset past its edge renders white below
 * on canvas and mid-grey in SVG — the two pipelines answering different
 * questions about the same document.
 *
 * Text and image layers paint unclipped (`fillText`/`drawImage`), so the fast
 * path survives for them; hollow shapes (`fill: none`) cast only from the
 * stroke and stay on it too. Only a filled shape clips.
 */
const needsUnclippedShadow = (layer: ResolvedLayer): boolean => {
  if (layer.kind === 'text') return false;
  if (!layer.resolvedSource.shape) return false;
  const fill = layer.resolvedFill;
  if (!fill || fill.kind === 'none') return false;
  return true;
};

/**
 * A classic outer shadow (legacy depth or spread-less drop), pre-rendered
 * from the silhouette and laid under the content.
 *
 * Same primitive and same numbers as the fast path (`shadowOffset*`,
 * `shadowBlur`, `shadowColor`) — the kernel does not move, only the clip
 * does: the silhouette paints on a full-size offscreen with no clip, so the
 * offset survives, and the interior is punched out (`destination-out`) so the
 * content the caller paints next lands on the same pixels it always did. The
 * draw resets filter, alpha and composite around itself: the silhouette
 * already carries the layer opacity, and the layer's own surface-blur must
 * not soften the shadow on the way in (the spread twin documents the same
 * rule for its own draw).
 *
 * Stroke casts are deliberately not part of the silhouette: the fast path
 * stacked a fill cast and a stroke cast, both clipped; one unclipped fill
 * cast covers every shape the parity gate pairs with a classic shadow, and a
 * hollow shape never reaches here at all.
 */
const paintClassicDropShadow = (
  main: CanvasRenderingContext2D,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  effect: LayerEffect,
  legacy: boolean
): void => {
  const ghost = backend.createCanvas(canvas.width, canvas.height);
  const g = ghost.native as CanvasRenderingContext2D;
  if (layer.resolvedTransform) {
    backend.applyTransform(ghost, layer.resolvedTransform);
  }
  if (legacy) {
    g.shadowOffsetX = Number(effect.params.x ?? 0);
    g.shadowOffsetY = Number(effect.params.y ?? 14);
    g.shadowBlur = Number(effect.params.blur ?? 28);
    g.shadowColor = String(effect.params.color ?? 'rgba(15, 23, 42, 0.28)');
  } else {
    g.shadowOffsetX = Number(effect.params.x ?? 0);
    g.shadowOffsetY = Number(effect.params.y ?? 8);
    g.shadowBlur = Number(effect.params.blur ?? 16);
    g.shadowColor = toRgba(
      String(effect.params.color ?? 'black'),
      Number(effect.params.opacity ?? 1)
    );
  }
  const shape = layer.resolvedSource.shape!;
  const x = (canvas.width - shape.width) / 2;
  const y = (canvas.height - shape.height) / 2;
  const lineCap = layer.resolvedStroke?.cap ?? 'round';
  // The silhouette carries the layer opacity (and a solid fill's own alpha)
  // so the cast has the strength the fast path's inherited `globalAlpha`
  // gave it — the shadow of a translucent layer is lighter, on both sides.
  const fill = layer.resolvedFill!;
  g.globalAlpha = layer.resolvedOpacity;
  g.fillStyle = fill.kind === 'solid' ? toRgba('#ffffff', fill.alpha ?? 1) : '#ffffff';
  traceShapePath(g, shape, x, y, lineCap);
  g.fill();
  // Punch the interior: only the outside fringe reaches the page, so a
  // translucent content never blends over a white silhouette of itself.
  g.save();
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
  g.shadowBlur = 0;
  g.shadowColor = 'rgba(0,0,0,0)';
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 1;
  traceShapePath(g, shape, x, y, lineCap);
  g.fill();
  g.restore();

  main.save();
  main.filter = 'none';
  main.globalAlpha = 1;
  main.globalCompositeOperation = 'source-over';
  main.drawImage(g.canvas, 0, 0);
  main.restore();
};

/**
 * Paint one layer's own pixels onto `target`: transform, text, shape
 * fill/stroke, inner shadow, images. Everything EXCEPT the drop shadow,
 * which the caller owns — the shadow either rides the draw operations
 * (`ctx.shadow*`, spread 0, unclipped layers) or is pre-rendered from a
 * silhouette (`paintClassicDropShadow` for a clipped filled shape,
 * `paintSpreadShadow` for spread != 0) and laid under this paint.
 *
 * Extracted so the spread path can render the same pixels twice (once white
 * for the shadow silhouette, once real for the layer) without two copies of
 * the geometry. The `spread === 0` main path calls this exactly once, in the
 * same order the inline code always ran, so its pixels do not move.
 */
const paintLayerContent = async (
  target: RenderContext,
  layer: ResolvedLayer,
  canvas: Dimensions,
  backend: RenderBackend
): Promise<void> => {
  const targetAny = target.native as CanvasRenderingContext2D;

  if (layer.resolvedTransform) {
    backend.applyTransform(target, layer.resolvedTransform);
  }

  if (layer.kind === 'text' && layer.resolvedText) {
    const text = layer.resolvedText;
    targetAny.fillStyle = layer.resolvedFill?.kind === 'solid' ? layer.resolvedFill.color ?? '#111827' : '#111827';
    targetAny.font = canvasFontShorthand(text);
    // `IC63/2` — a âncora vem da caixa da layer, não do centro do canvas. Sem isto,
    // alinhar à esquerda faria o texto crescer para a direita a partir do meio, que é
    // o oposto de "esquerda". A geometria mora em `textLayout.ts` e o SVG consome a
    // mesma função — dois pipelines, uma decisão.
    const place = resolveTextPlacement(canvas, layer.resolvedSource.shape, text.textAlign);
    targetAny.textAlign = place.canvasAlign;
    targetAny.textBaseline = 'middle';
    targetAny.fillText(text.content, place.x, place.y);
  }

  if (layer.resolvedSource.shape && layer.kind !== 'text') {
    const shape = layer.resolvedSource.shape;
    const x = (canvas.width - shape.width) / 2;
    const y = (canvas.height - shape.height) / 2;
    // Only a line reads the cap: it shapes the body itself, not an outline.
    const lineCap = layer.resolvedStroke?.cap ?? 'round';
    if (layer.resolvedFill) {
      targetAny.save();
      traceShapePath(targetAny, shape, x, y, lineCap);
      targetAny.clip();
      backend.applyFill(target, layer.resolvedFill, x, y, shape.width, shape.height);
      targetAny.restore();
    }
    if (layer.resolvedStroke && shape.kind !== 'line') {
      const stroke = layer.resolvedStroke;
      targetAny.save();
      targetAny.strokeStyle = stroke.color;
      targetAny.lineCap = stroke.cap ?? 'butt';
      targetAny.lineJoin = stroke.join ?? 'miter';
      // The platforms' default the reference relies on: beyond it, mitered
      // corners bevel instead of spiking.
      targetAny.miterLimit = 4;
      if (stroke.alignment === 'center') {
        targetAny.lineWidth = stroke.width;
        traceShapePath(targetAny, shape, x, y);
        targetAny.stroke();
      } else {
        // Half of the doubled stroke lands on each side of the outline; the
        // clip keeps the half the alignment asks for.
        targetAny.lineWidth = stroke.width * 2;
        if (stroke.alignment === 'inside') {
          traceShapePath(targetAny, shape, x, y);
          targetAny.clip();
        } else {
          targetAny.beginPath();
          targetAny.rect(0, 0, canvas.width, canvas.height);
          addShapeSubpath(targetAny, shape, x, y);
          targetAny.clip('evenodd');
        }
        traceShapePath(targetAny, shape, x, y);
        targetAny.stroke();
      }
      targetAny.restore();
    }
    // Inner shadow: the shadow of the inverse region, kept by a clip to the
    // shape — the hole's edge casts into the hole and nothing else paints.
    const innerShadow = layer.resolvedEffects?.find((effect) => effect.kind === 'inner-shadow' && effect.enabled);
    if (innerShadow) {
      if (shadowSpread(innerShadow) === 0) {
        targetAny.save();
        traceShapePath(targetAny, shape, x, y, lineCap);
        targetAny.clip();
        targetAny.shadowOffsetX = Number(innerShadow.params.x ?? 0);
        targetAny.shadowOffsetY = Number(innerShadow.params.y ?? 6);
        targetAny.shadowBlur = Number(innerShadow.params.blur ?? 12);
        targetAny.shadowColor = toRgba(
          String(innerShadow.params.color ?? 'black'),
          Number(innerShadow.params.opacity ?? 0.35)
        );
        targetAny.beginPath();
        targetAny.rect(0, 0, canvas.width, canvas.height);
        addShapeSubpath(targetAny, shape, x, y, lineCap);
        targetAny.fillStyle = 'black';
        targetAny.fill('evenodd');
        targetAny.restore();
      } else {
        await paintInnerShadowSpread(targetAny, backend, canvas, shape, x, y, lineCap, innerShadow);
      }
    }
  }

  if (layer.resolvedSource.type === 'inline' && layer.resolvedSource.data) {
    try {
      const mimeType = layer.resolvedSource.mimeType ?? 'image/png';

      /**
       * `IC63/1b` — the canvas half of the recolor.
       *
       * The canvas rasterizes the asset through `Image`, so there is no paint model to
       * write into: the only place the color exists is **the markup**, and it has to be
       * rewritten *before* it becomes a blob. Same pure function the SVG pipeline
       * calls (`applySvgPaintOverrides`), which is what keeps the two renderings from
       * drifting — `IC-N28` happened because the rewrite would have been written twice.
       *
       * The recolored path builds the blob from the **text bytes** instead of decoding
       * base64 and re-encoding it: the round trip would be pure waste, and this is the
       * only place in the renderer where a Blob is built from markup.
       *
       * Guarded on there being overrides, so the overwhelmingly common case — an SVG
       * nobody recolored — takes the exact same bytes it always did.
       */
      const overrides = layer.resolvedSvgPaintOverrides;
      const temOverride = overrides && Object.keys(overrides).length > 0;
      const ehSvg = mimeType === 'image/svg+xml';

      let blob: Blob;
      if (temOverride && ehSvg) {
        const markup = atob(layer.resolvedSource.data);
        blob = new Blob([new TextEncoder().encode(applySvgPaintOverrides(markup, overrides))], {
          type: mimeType
        });
      } else {
        const binary = atob(layer.resolvedSource.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: mimeType });
      }

      const img = await backend.loadImage(blob);
      const rect = layerBaseRect({ source: layer.resolvedSource }, canvas, img);
      backend.drawImage(target, img, rect.cx - rect.w / 2, rect.cy - rect.h / 2, rect.w, rect.h);
    } catch {
      // Skip layers that fail to load
    }
  }

  if (layer.resolvedSource.type === 'reference' && layer.resolvedSource.path) {
    try {
      const img = await backend.loadImage(layer.resolvedSource.path);
      const rect = layerBaseRect({ source: layer.resolvedSource }, canvas, img);
      backend.drawImage(target, img, rect.cx - rect.w / 2, rect.cy - rect.h / 2, rect.w, rect.h);
    } catch {
      // Skip layers that fail to load
    }
  }

  // Grain last: over fill, stroke, inner shadow and images alike. The spread
  // twin strips effects, so the silhouette never wears grain.
  const noise = layer.resolvedEffects?.find((effect) => effect.kind === 'noise-grain' && effect.enabled);
  if (noiseActive(noise)) {
    paintNoiseGrain(target, backend, canvas, layer, noise!);
  }
};

/**
 * Inner shadow with a non-zero spread, pre-rendered.
 *
 * The `shadow*` trick cannot grow or shrink a contour, so the contour moves
 * first: a white page with the shape punched out (the inverse region the
 * classic path fills as a path), morphed — dilate shrinks the hole for a
 * positive spread so the shadow reaches further in, erode grows it so the
 * shadow recedes — then tinted, blurred and kept only inside the shape by a
 * `destination-in` of the shape itself. No `drawImage`-with-shadow anywhere:
 * that would paint the white mask over the layer; only the blurred shadow
 * colour ever reaches `target`.
 */
const paintInnerShadowSpread = async (
  targetAny: CanvasRenderingContext2D,
  backend: RenderBackend,
  canvas: Dimensions,
  shape: NonNullable<IconLayer['source']['shape']>,
  x: number,
  y: number,
  lineCap: 'butt' | 'round' | 'square',
  effect: LayerEffect
): Promise<void> => {
  const spread = shadowSpread(effect);
  const mask = backend.createCanvas(canvas.width, canvas.height);
  const m = mask.native as CanvasRenderingContext2D;
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, canvas.width, canvas.height);
  m.globalCompositeOperation = 'destination-out';
  traceShapePath(m, shape, x, y, lineCap);
  m.fill();
  m.globalCompositeOperation = 'source-over';
  morphAlphaChannel(m, canvas.width, canvas.height, Math.abs(spread), spread > 0 ? 'dilate' : 'erode');

  m.globalCompositeOperation = 'source-in';
  m.fillStyle = toRgba(
    String(effect.params.color ?? 'black'),
    Number(effect.params.opacity ?? 0.35)
  );
  m.fillRect(0, 0, canvas.width, canvas.height);
  m.globalCompositeOperation = 'source-over';

  const soft = backend.createCanvas(canvas.width, canvas.height);
  const s = soft.native as CanvasRenderingContext2D;
  // Half the blur param: `blur(Npx)` ≡ `stdDeviation=N` (measured 1:1 in
  // Chromium vs sharp, `.dev/tmp/fx2-kernel-proof.mjs`), and the SVG side
  // emits `stdDeviation = blur/2` — the same textbook mapping the `sombra`
  // fixture pins for `shadowBlur`. A full-radius `blur()` here paints double
  // the fringe the export has.
  const blurPx = Number(effect.params.blur ?? 12) / 2;
  if (blurPx > 0) s.filter = `blur(${blurPx}px)`;
  s.drawImage(m.canvas, 0, 0);
  s.filter = 'none';
  s.globalCompositeOperation = 'destination-in';
  traceShapePath(s, shape, x, y, lineCap);
  s.fillStyle = '#ffffff';
  s.fill();
  s.globalCompositeOperation = 'source-over';

  targetAny.save();
  // The offset shifts AFTER the clip-bound composite (the classic path clips
  // first and offsets the cast, which never leaves the shape). Drawing the
  // offset image unclipped leaked a halo outside the shape — measured as a
  // grey fringe below the bottom edge before this clip existed.
  traceShapePath(targetAny, shape, x, y, lineCap);
  targetAny.clip();
  targetAny.drawImage(
    s.canvas,
    Number(effect.params.x ?? 0),
    Number(effect.params.y ?? 6)
  );
  targetAny.restore();
};

/**
 * Background blur (Tier 2, fatia 2.1): soften what is BEHIND the layer —
 * the CSS `backdrop-filter: blur()` semantics.
 *
 * Canvas2D cannot see behind in one pass, so this is two passes: snapshot
 * the composed-so-far canvas (background + every layer below), blur the
 * copy, and lay it back CLIPPED to this layer's footprint — then the caller
 * paints the layer itself on top. State is fully owned inside (filter,
 * alpha and composite are reset around the draw and restored after), because
 * the layer's own opacity/blend/filter describe the layer, not its backdrop:
 * inheriting them would tint the background with the foreground's paint.
 *
 * The footprint follows the layer transform (the clip is taken under the
 * same `applyTransform` the content paint uses, then the transform is reset
 * to identity for the snapshot draw — the clip survives in device space).
 * Shape layers clip to the outline; anything else (text box, image) clips to
 * the layer box from `layerBaseRect`. A non-positive radius is off: zero
 * work, and the SVG side emits zero markup for it by the same rule.
 */
const paintBackdropBlur = (
  main: CanvasRenderingContext2D,
  target: RenderContext,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer
): void => {
  const effect = layer.resolvedEffects?.find((item) => item.kind === 'backdrop-blur' && item.enabled);
  const radius = effect ? Number(effect.params.radius ?? 0) : 0;
  if (!effect || radius <= 0) return;
  blurBehind(main, target, backend, canvas, layer, radius);
};

/**
 * The blur-behind core shared by backdrop-blur (2.1) and glass (2.2):
 * snapshot the composed-so-far canvas, blur the copy, lay it back clipped
 * to the layer footprint. Glass calls this directly with its `blurRadius` —
 * one mechanism, two entries, no second implementation to drift.
 */
const blurBehind = (
  main: CanvasRenderingContext2D,
  target: RenderContext,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  radius: number
): void => {
  const snapshot = backend.createCanvas(canvas.width, canvas.height);
  (snapshot.native as CanvasRenderingContext2D).drawImage(main.canvas, 0, 0);
  const soft = backend.createCanvas(canvas.width, canvas.height);
  const softAny = soft.native as CanvasRenderingContext2D;
  softAny.filter = `blur(${radius}px)`;
  softAny.drawImage((snapshot.native as CanvasRenderingContext2D).canvas, 0, 0);

  main.save();
  main.filter = 'none';
  main.globalAlpha = 1;
  main.globalCompositeOperation = 'source-over';
  if (layer.resolvedTransform) {
    backend.applyTransform(target, layer.resolvedTransform);
  }
  clipLayerFootprint(main, canvas, layer);
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.drawImage(softAny.canvas, 0, 0);
  main.restore();
};

/**
 * Clip the layer footprint (under the caller's transform): the shape outline
 * for shape layers, the layer box otherwise. Shared by the backdrop core and
 * the glass tint/frost coats — one footprint, every coat agrees on it.
 */
const clipLayerFootprint = (
  main: CanvasRenderingContext2D,
  canvas: Dimensions,
  layer: ResolvedLayer
): void => {
  const shape = layer.kind !== 'text' ? layer.resolvedSource.shape : undefined;
  if (shape) {
    traceShapePath(main, shape, (canvas.width - shape.width) / 2, (canvas.height - shape.height) / 2, layer.resolvedStroke?.cap ?? 'round');
    main.clip();
  } else {
    const box = layerBaseRect({ source: layer.resolvedSource }, canvas);
    main.beginPath();
    main.rect(box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
    main.clip();
  }
};

/** mulberry32: tiny seeded PRNG so the grain tile is byte-identical every render. */
const frostRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fixed grain parameters, shared by glass frost (2.2) and noise-grain (2.3). */
export const GRAIN_TILE_PX = 128;
export const GRAIN_SEED = 0x1c04ec;

/**
 * Paint a grain tile: mid-grey with symmetric variance, opaque.
 * The caller sets the strength through `globalAlpha` — the tile itself is
 * constant, so frost/noise amounts stay comparable across calls. Fixed seed
 * and a pure integer loop: two renders are byte-identical by construction.
 *
 * Monochrome draws one value into all channels (film grain); colour draws an
 * independent value per channel (sensor noise). Same seed, same sequence —
 * only the fan-out differs.
 */
export const paintGrainTile = (
  native: CanvasRenderingContext2D,
  size: number = GRAIN_TILE_PX,
  seed: number = GRAIN_SEED,
  variance = 44,
  monochrome = true
): void => {
  const image = native.createImageData(size, size);
  const rand = frostRandom(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    if (monochrome) {
      const v = 128 + Math.round((rand() * 2 - 1) * variance);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
    } else {
      image.data[i] = 128 + Math.round((rand() * 2 - 1) * variance);
      image.data[i + 1] = 128 + Math.round((rand() * 2 - 1) * variance);
      image.data[i + 2] = 128 + Math.round((rand() * 2 - 1) * variance);
    }
    image.data[i + 3] = 255;
  }
  native.putImageData(image, 0, 0);
};

/** Whether a noise-grain entry acts: enabled with a live amount. */
export const noiseActive = (effect: LayerEffect | undefined): boolean => {
  if (!effect || !effect.enabled) return false;
  return Number(effect.params.amount ?? 0) > 0;
};

/** Cap on stacked bloom coats: the SVG cost is linear in coats, the PNG cost quadratic-ish. */
export const BLOOM_INTENSITY_MAX = 5;

/** Whether a bloom entry acts: enabled with blur and at least one coat. */
export const bloomActive = (effect: LayerEffect | undefined): boolean => {
  if (!effect || !effect.enabled) return false;
  return Number(effect.params.blur ?? 0) > 0 && Math.round(Number(effect.params.intensity ?? 0)) >= 1;
};

/** Coats of a bloom entry, clamped to the proven interval. */
export const bloomIntensity = (effect: LayerEffect): number => {
  const raw = Math.round(Number(effect.params.intensity ?? 0));
  return Math.min(BLOOM_INTENSITY_MAX, Math.max(1, raw));
};

/** Blur radius of one bloom coat: half the param — the same mapping the SVG side emits as `stdDeviation`. */
export const bloomBlurPx = (effect: LayerEffect): number => Number(effect.params.blur ?? 0) / 2;

/** Flood paint of the coats. */
export const bloomFlood = (effect: LayerEffect): string =>
  toRgba(String(effect.params.color ?? 'black'), Number(effect.params.opacity ?? 1));

const NOISE_PEAK_ALPHA = 0.5;
export const NOISE_SIZE_MIN = 1;
export const NOISE_SIZE_MAX = 8;

/** Grain cell size in px, clamped to the proven slider interval. */
export const noiseSizePx = (effect: LayerEffect): number => {
  const raw = Number(effect.params.size ?? 2);
  return Math.min(NOISE_SIZE_MAX, Math.max(NOISE_SIZE_MIN, Math.round(raw)));
};

/**
 * Noise grain (Tier 2, fatia 2.3): the fixed-seed tile over the layer's own
 * paint, clipped to the footprint. Painted by `paintLayerContent` itself —
 * last, so it grains fill, stroke, inner shadow and images alike, and so the
 * spread-shadow twin (which strips effects) never sees it. Cell size scales
 * the tile with smoothing off (chunky grain, no blur); monochrome picks the
 * tile mode. Amount zero/disabled paints nothing.
 */
const paintNoiseGrain = (
  target: RenderContext,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  effect: LayerEffect
): void => {
  const targetAny = target.native as CanvasRenderingContext2D;
  const amount = Math.min(1, Math.max(0, Number(effect.params.amount ?? 0)));
  if (amount <= 0) return;
  const cell = noiseSizePx(effect);
  const mono = effect.params.monochrome === undefined ? true : Boolean(effect.params.monochrome);

  const tile = backend.createCanvas(GRAIN_TILE_PX, GRAIN_TILE_PX);
  paintGrainTile(tile.native as CanvasRenderingContext2D, GRAIN_TILE_PX, GRAIN_SEED, 44, mono);
  let grain: CanvasRenderingContext2D = tile.native as CanvasRenderingContext2D;
  if (cell > 1) {
    const big = backend.createCanvas(GRAIN_TILE_PX * cell, GRAIN_TILE_PX * cell);
    const bigAny = big.native as CanvasRenderingContext2D;
    bigAny.imageSmoothingEnabled = false;
    bigAny.drawImage(grain.canvas, 0, 0, GRAIN_TILE_PX * cell, GRAIN_TILE_PX * cell);
    grain = bigAny;
  }

  // Own state: the caller (spread twin included) must not leak alpha into
  // this, and this must not leak the pattern out.
  const pattern = grain.createPattern(grain.canvas, 'repeat');
  if (!pattern) return;
  targetAny.save();
  if (layer.resolvedTransform) {
    backend.applyTransform(target, layer.resolvedTransform);
  }
  const shape = layer.kind !== 'text' ? layer.resolvedSource.shape : undefined;
  if (shape) {
    traceShapePath(targetAny, shape, (canvas.width - shape.width) / 2, (canvas.height - shape.height) / 2, layer.resolvedStroke?.cap ?? 'round');
    targetAny.clip();
  } else {
    const box = layerBaseRect({ source: layer.resolvedSource }, canvas);
    targetAny.beginPath();
    targetAny.rect(box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
    targetAny.clip();
  }
  targetAny.globalAlpha = amount * NOISE_PEAK_ALPHA;
  targetAny.fillStyle = pattern;
  // Pattern space follows the transform above; cover generously so rotation
  // never uncovers a corner.
  targetAny.fillRect(-canvas.width, -canvas.height, canvas.width * 3, canvas.height * 3);
  targetAny.restore();
};

/** Whether a glass entry acts: enabled with at least one live param. */
export const glassActive = (effect: LayerEffect | undefined): boolean => {
  if (!effect || !effect.enabled) return false;
  return (
    Number(effect.params.blurRadius ?? 0) > 0 ||
    Number(effect.params.tintOpacity ?? 0) > 0 ||
    Number(effect.params.edgeHighlight ?? 0) > 0 ||
    Number(effect.params.frost ?? 0) > 0
  );
};

const GLASS_EDGE_PX = 3;
const FROST_PEAK_ALPHA = 0.16;

/**
 * Glass v1 (Tier 2, fatia 2.2): exactly tint/tintOpacity/blurRadius/
 * edgeHighlight/frost — a composition of proven techniques, no new physics.
 * Blur-behind reuses the 2.1 core; the tint is a flat coat; the edge is an
 * inner white stroke; the frost is the fixed-seed grain tile (the same tile
 * 2.3 exposes as noise-grain). Coats that are off are skipped, so an enabled
 * entry with every param at zero paints nothing — and the SVG side emits
 * nothing for it by the same rule.
 */
const paintGlass = (
  main: CanvasRenderingContext2D,
  target: RenderContext,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  effect: LayerEffect
): void => {
  const blurRadius = Number(effect.params.blurRadius ?? 0);
  if (blurRadius > 0) {
    blurBehind(main, target, backend, canvas, layer, blurRadius);
  }

  const tintOpacity = clamp01(Number(effect.params.tintOpacity ?? 0));
  if (tintOpacity > 0) {
    main.save();
    if (layer.resolvedTransform) {
      backend.applyTransform(target, layer.resolvedTransform);
    }
    const shape = layer.kind !== 'text' ? layer.resolvedSource.shape : undefined;
    main.beginPath();
    if (shape) {
      addShapeSubpath(main, shape, (canvas.width - shape.width) / 2, (canvas.height - shape.height) / 2, layer.resolvedStroke?.cap ?? 'round');
    } else {
      const box = layerBaseRect({ source: layer.resolvedSource }, canvas);
      main.rect(box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
    }
    main.fillStyle = toRgba(String(effect.params.tint ?? '#ffffff'), tintOpacity);
    main.fill();
    main.restore();
  }

  const edge = clamp01(Number(effect.params.edgeHighlight ?? 0));
  const edgeShape = layer.kind !== 'text' ? layer.resolvedSource.shape : undefined;
  if (edge > 0 && edgeShape) {
    main.save();
    if (layer.resolvedTransform) {
      backend.applyTransform(target, layer.resolvedTransform);
    }
    traceShapePath(
      main,
      edgeShape,
      (canvas.width - edgeShape.width) / 2,
      (canvas.height - edgeShape.height) / 2,
      layer.resolvedStroke?.cap ?? 'round'
    );
    main.clip();
    traceShapePath(
      main,
      edgeShape,
      (canvas.width - edgeShape.width) / 2,
      (canvas.height - edgeShape.height) / 2,
      layer.resolvedStroke?.cap ?? 'round'
    );
    main.lineWidth = GLASS_EDGE_PX * 2;
    main.strokeStyle = toRgba('#ffffff', edge);
    main.stroke();
    main.restore();
  }

  const frost = clamp01(Number(effect.params.frost ?? 0));
  if (frost > 0) {
    const tile = backend.createCanvas(GRAIN_TILE_PX, GRAIN_TILE_PX);
    const tileAny = tile.native as CanvasRenderingContext2D;
    paintGrainTile(tileAny);
    main.save();
    if (layer.resolvedTransform) {
      backend.applyTransform(target, layer.resolvedTransform);
    }
    clipLayerFootprint(main, canvas, layer);
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalAlpha = frost * FROST_PEAK_ALPHA;
    main.fillStyle = main.createPattern(tileAny.canvas, 'repeat') ?? 'rgba(128,128,128,1)';
    main.fillRect(0, 0, canvas.width, canvas.height);
    main.restore();
  }
};

/**
 * Bloom (Tier 3), pre-rendered under the layer.
 *
 * Recursive coats with the thin kernel, NOT stacked `drop-shadow()` filters:
 * measured, one verbatim coat agrees with `feDropShadow` bit-for-bit, but the
 * CSS kernel's tails are fatter — stacking re-blurs the difference and two
 * coats already sit at 19,4% fora-tolerância against the SVG chain (the
 * single-coat proof in SPIKE 3.1 only ever showed acceptance, not stacking).
 * Each coat here is `blur()` + flood `source-in` — the same primitives the
 * spread path uses, and the same math the SVG `feDropShadow` chain does —
 * which agrees at 0% fora for 1–3 coats.
 *
 * The twin is the spread twin (paints whitened, opacity reset, effects
 * stripped — the silhouette is the contour). The accumulation `G` starts
 * transparent and each coat floods `blur(silhouette + G)` into it, so the
 * white core never reaches the page: the caller draws `G`, then the real
 * layer cleanly on top. Opacity rides `globalAlpha` (the SVG group opacity
 * covers the filtered result the same way), under `source-over`, so a
 * blended layer blends its content — not its glow — like the drop path.
 */
const paintBloom = async (
  main: CanvasRenderingContext2D,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  effect: LayerEffect
): Promise<void> => {
  if (!bloomActive(effect)) return;
  const r = bloomBlurPx(effect);
  const flood = bloomFlood(effect);
  const ghost = backend.createCanvas(canvas.width, canvas.height);
  const whiteFill = layer.resolvedFill && layer.resolvedFill.kind !== 'none'
    ? { kind: 'solid', color: '#ffffff' } as Fill
    : layer.resolvedFill;
  const whiteStroke = layer.resolvedStroke
    ? { ...layer.resolvedStroke, color: '#ffffff' }
    : undefined;
  const twin: ResolvedLayer = {
    ...layer,
    resolvedFill: whiteFill,
    resolvedStroke: whiteStroke,
    resolvedOpacity: 1,
    resolvedBlendMode: 'normal',
    resolvedEffects: [],
    imageFilter: undefined
  };
  await paintLayerContent(ghost, twin, canvas, backend);

  const glow = backend.createCanvas(canvas.width, canvas.height);
  const G = glow.native as CanvasRenderingContext2D;
  for (let coat = 0; coat < bloomIntensity(effect); coat++) {
    const step = backend.createCanvas(canvas.width, canvas.height);
    const S = step.native as CanvasRenderingContext2D;
    S.drawImage((ghost.native as CanvasRenderingContext2D).canvas, 0, 0);
    S.drawImage((glow.native as CanvasRenderingContext2D).canvas, 0, 0);
    const blurred = backend.createCanvas(canvas.width, canvas.height);
    const B = blurred.native as CanvasRenderingContext2D;
    B.filter = `blur(${r}px)`;
    B.drawImage((step.native as CanvasRenderingContext2D).canvas, 0, 0);
    B.filter = 'none';
    B.globalCompositeOperation = 'source-in';
    B.fillStyle = flood;
    B.fillRect(0, 0, canvas.width, canvas.height);
    G.drawImage((blurred.native as CanvasRenderingContext2D).canvas, 0, 0);
  }

  main.save();
  main.globalCompositeOperation = 'source-over';
  main.globalAlpha = layer.resolvedOpacity;
  main.drawImage((glow.native as CanvasRenderingContext2D).canvas, 0, 0);
  main.restore();
};

/**
 * Drop shadow with a non-zero spread, pre-rendered under the layer.
 *
 * Same contour-first order as the inner variant: the layer paints white into
 * an offscreen (a "twin" with paints whitened, opacity reset and effects
 * stripped — the silhouette is the contour, and inner effects never change
 * it), the silhouette is tinted to the shadow colour through `source-in`
 * (inheriting the layer's opacity via `globalAlpha`, the way `ctx.shadow*`
 * inherits it on the fast path), morphed, blurred and drawn at the offset.
 * The caller then paints the real layer cleanly on top.
 *
 * The layer's own surface-blur must NOT soften this image again on the way
 * in (`ctx.filter` applies to `drawImage` too), so the draw resets the
 * filter around itself. The shadow therefore never wears the layer's blur —
 * the one documented difference from the `spread === 0` path, where the
 * shadow rides operations the filter touches.
 */
const paintSpreadShadow = async (
  main: CanvasRenderingContext2D,
  backend: RenderBackend,
  canvas: Dimensions,
  layer: ResolvedLayer,
  effect: LayerEffect
): Promise<void> => {
  const spread = shadowSpread(effect);
  const ghost = backend.createCanvas(canvas.width, canvas.height);
  const whiteFill = layer.resolvedFill && layer.resolvedFill.kind !== 'none'
    ? { kind: 'solid', color: '#ffffff' } as Fill
    : layer.resolvedFill;
  const whiteStroke = layer.resolvedStroke
    ? { ...layer.resolvedStroke, color: '#ffffff' }
    : undefined;
  const twin: ResolvedLayer = {
    ...layer,
    resolvedFill: whiteFill,
    resolvedStroke: whiteStroke,
    resolvedOpacity: 1,
    resolvedBlendMode: 'normal',
    resolvedEffects: [],
    imageFilter: undefined
  };
  await paintLayerContent(ghost, twin, canvas, backend);

  const g = ghost.native as CanvasRenderingContext2D;
  g.save();
  g.globalCompositeOperation = 'source-in';
  g.globalAlpha = layer.resolvedOpacity;
  g.fillStyle = toRgba(
    String(effect.params.color ?? 'black'),
    Number(effect.params.opacity ?? 1)
  );
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.restore();
  morphAlphaChannel(g, canvas.width, canvas.height, Math.abs(spread), spread > 0 ? 'dilate' : 'erode');

  // Straight onto the main canvas: one fewer offscreen hop than blurring
  // into a temp first, and each hop quantizes the soft gradient to 8 bits.
  // Measured with neutral morphology (spread 0.001): this container matches
  // the SVG expansion byte-for-byte (0% fora) and sits 6.2% off the classic
  // `shadowBlur` path — exactly the pre-existing kernel band between
  // `shadowBlur` and `feGaussianBlur` on the no-spread fixture, i.e. the
  // container adds no divergence of its own.
  // Half the param: `blur(Npx)` ≡ `stdDeviation=N` (measured 1:1), and the
  // SVG side emits `stdDeviation = blur/2` — the textbook mapping.
  const blurPx = Number(effect.params.blur ?? 16) / 2;
  main.save();
  main.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
  main.drawImage(
    g.canvas,
    Number(effect.params.x ?? 0),
    Number(effect.params.y ?? 8)
  );
  main.restore();
};

export const composeLayers = async (
  layers: IconLayer[],
  canvas: Dimensions,
  background: Fill,
  variant: IconVariant,
  safeArea: { inset: number; shape: ShapeKind } | undefined,
  backend: RenderBackend,
  /** When set, the finished image is clipped to this outline. See clipToShape. */
  clipShape?: CanvasMaskShape,
  /**
   * The project's own canvas, read for the declared `maskRadius`. Falls back to
   * `canvas` when omitted, so a caller with no project still clips — it just
   * uses the shape default.
   */
  projectCanvas?: { size: number; height?: number; maskRadius?: number; maskShape?: CanvasMaskShape }
): Promise<Blob> => {
  const ctx = backend.createCanvas(canvas.width, canvas.height);
  const ctxAny = ctx.native as CanvasRenderingContext2D;

  /**
   * The canvas mask is clipped **before** anything is drawn.
   *
   * `clip()` in Canvas2D is not a filter over the finished image: it changes
   * what subsequent drawing operations are allowed to touch. A clip applied
   * after the layers are painted brackets nothing, and the render comes back
   * unclipped. This version did exactly that — the outline was traced after the
   * last layer, which is why measuring the PNGs showed `mask: 'rounded-rectangle'`
   * and `mask: 'none'` producing byte-identical output.
   *
   * So the order is: establish the clip, paint, encode. `applyMask` cannot do
   * this either, because it saves and restores around the clip, which cancels it.
   */
  if (clipShape) {
    clipToShape(ctxAny, canvas, clipShape, projectCanvas ?? {
      size: canvas.width,
      height: canvas.height,
      maskShape: clipShape
    });
  }

  // `kind: 'none'` means "no background paint" — keep the alpha channel.
  if (background.kind !== 'none') {
    backend.applyFill(ctx, background, 0, 0, canvas.width, canvas.height);
  }

  const resolved: ResolvedLayer[] = layers
    .map(l => resolveLayerForVariant(l, variant))
    // The background layer is a UI handle for `canvas.background`; it never
    // contributes pixels.
    .filter(l => l.resolvedVisible && l.role !== 'background')
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of resolved) {
    const ctxAny = ctx.native as CanvasRenderingContext2D;
    ctxAny.save();

    // Backdrop first: it rewrites what is behind the layer, so it runs
    // before the layer's own filter/opacity/blend/shadow/content. A layer
    // without the effect skips with zero work.
    paintBackdropBlur(ctxAny, ctx, backend, canvas, layer);

    // Glass coats (tint/edge/frost over a blurred behind): same position in
    // the stack, for the same reason. Stacks with a backdrop-blur entry when
    // both are present — two blurs, documented, not prevented.
    const glass = layer.resolvedEffects?.find((effect) => effect.kind === 'glass');
    if (glassActive(glass)) {
      paintGlass(ctxAny, ctx, backend, canvas, layer, glass!);
    }

    // Bloom under the content: the glow of the silhouette, laid before the
    // layer paints (the fill clip would amputate it past the edge — the same
    // reason spread shadows pre-render). Skips with zero work when off.
    const bloom = layer.resolvedEffects?.find((effect) => effect.kind === 'bloom');
    if (bloomActive(bloom)) {
      await paintBloom(ctxAny, backend, canvas, layer, bloom!);
    }

    // Combined CSS filter (image color adjustments + surface blur). Bloom is
    // NOT here: it rides its own silhouette pass below (`paintBloom`), for
    // the clip reason documented on `bloomFilterCss`. Saved/restored with
    // the context.
    const blurEffect = layer.resolvedEffects?.find((effect) => effect.kind === 'surface-blur' && effect.enabled);
    const blurPx = blurEffect ? Number(blurEffect.params.radius ?? 0) : 0;
    const filterStr = [imageFilterToCss(layer.imageFilter), blurPx > 0 ? `blur(${blurPx}px)` : ''].filter(Boolean).join(' ');
    if (filterStr) ctxAny.filter = filterStr;

    if (layer.resolvedBlendMode && layer.resolvedBlendMode !== 'normal') {
      backend.applyBlendMode(ctx, layer.resolvedBlendMode);
    }

    if (layer.resolvedOpacity < 1) {
      backend.applyOpacity(ctx, layer.resolvedOpacity);
    }

    const legacyShadow = layer.resolvedEffects?.find((effect) => effect.kind === 'depth-shadow' && effect.enabled);
    const dropShadow = layer.resolvedEffects?.find((effect) => effect.kind === 'drop-shadow' && effect.enabled);
    if (legacyShadow) {
      // The composer-era shadow. Unclipped layers keep it byte-for-byte; a
      // filled shape pre-renders (same clip reason as the generic drop below).
      if (needsUnclippedShadow(layer)) {
        // Same clip reason as the generic drop below: the fill clip would
        // amputate the offset, so the shadow pre-renders and the content
        // paints clean.
        paintClassicDropShadow(ctxAny, backend, canvas, layer, legacyShadow, true);
      } else {
        ctxAny.shadowOffsetX = Number(legacyShadow.params.x ?? 0);
        ctxAny.shadowOffsetY = Number(legacyShadow.params.y ?? 14);
        ctxAny.shadowBlur = Number(legacyShadow.params.blur ?? 28);
        ctxAny.shadowColor = String(legacyShadow.params.color ?? 'rgba(15, 23, 42, 0.28)');
      }
    } else if (dropShadow) {
      if (shadowSpread(dropShadow) === 0) {
        if (needsUnclippedShadow(layer)) {
          // The fill clip amputates the offset (see needsUnclippedShadow):
          // pre-render unclipped, then paint the content with no shadow set.
          paintClassicDropShadow(ctxAny, backend, canvas, layer, dropShadow, false);
        } else {
          // The generic drop shadow (a glow is the same effect with zero offset).
          ctxAny.shadowOffsetX = Number(dropShadow.params.x ?? 0);
          ctxAny.shadowOffsetY = Number(dropShadow.params.y ?? 8);
          ctxAny.shadowBlur = Number(dropShadow.params.blur ?? 16);
          ctxAny.shadowColor = toRgba(
            String(dropShadow.params.color ?? 'black'),
            Number(dropShadow.params.opacity ?? 1)
          );
        }
      } else {
        // Spread: the shadow is pre-rendered from the silhouette and laid
        // under the layer; the paint below runs clean, with no `shadow*` set.
        await paintSpreadShadow(ctxAny, backend, canvas, layer, dropShadow);
      }
    }

    await paintLayerContent(ctx, layer, canvas, backend);

    ctxAny.restore();
  }

  if (safeArea) {
    // Safe area is a square preview GUIDE by contract and never clips an export; a
    // non-square guide is out of scope here, so the inset stays relative to `width`.
    backend.applyMask(ctx, safeArea.shape, canvas.width, safeArea.inset * canvas.width);
  }

  return backend.toBlob(ctx, 'image/png');
};

/**
 * Clip the finished composition to the canvas outline.
 *
 * `canvas` here is the project's canvas, not the render target: the radius is
 * **read from the document** through `resolveMaskRadius`, so a radius the owner
 * set is the radius that appears. Recomputing the shape default inside this
 * function would silently ignore `canvas.maskRadius` — which is exactly what a
 * first version did, and what the test caught (asked for 22, got 24).
 */
const clipToShape = (
  native: CanvasRenderingContext2D,
  target: { width: number; height: number },
  shape: CanvasMaskShape,
  projectCanvas: { size: number; height?: number; maskRadius?: number; maskShape?: CanvasMaskShape }
): void => {
  const { width, height } = target;
  const radius = Math.min(
    resolveMaskRadius(projectCanvas),
    Math.min(width, height) / 2
  );

  native.save();
  native.beginPath();
  switch (shape) {
    case 'circle':
      native.ellipse(width / 2, height / 2, Math.min(width, height) / 2, Math.min(width, height) / 2, 0, 0, Math.PI * 2);
      break;
    case 'squircle':
      clipSquircle(native, Math.min(width, height));
      break;
    default:
      native.roundRect(0, 0, width, height, radius);
      break;
  }
  native.closePath();
  native.clip();
  // Intentionally no `restore()`: the clip must survive until `toBlob`. The
  // context is discarded right after, so there is nothing to leak into.
};
