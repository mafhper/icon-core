import type { BlendMode, CanvasMaskShape, Dimensions, Fill, GradientFill, IconCoreProject, IconLayer, IconVariant, ShapeDefinition, ImageFilter } from '@iconcore/shared';
import { resolveMaskRadius, resolveSize } from '@iconcore/shared';
import { toRgba } from './color';
import { escapeXml } from './escapeXml';
import { layerBaseRect } from './geometry';
import { superellipsePathD } from './geometry/superellipse';
import { conicStartRadians, cssAngleVector, expandStopsDetailed, sampleStops } from './gradient';
import { parseSvgIntrinsicSize, namespaceSvgIds, setSvgViewport } from './svgSize';
import { applySvgPaintOverrides } from './svgPaint';
import type { RenderBackground } from './types';

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
 * One shape element, filled with `paint`, carrying opacity/transform/filter.
 *
 * `offsetX/offsetY` place the shape's top-left corner. The Canvas2D compositor
 * centres a shape at `((S - w) / 2, (S - h) / 2)` (`composeLayers`), so layer
 * markup must pass that; the `clipPath` reuse must pass `0, 0` because it
 * shares a coordinate space with `approximationMarkup`.
 */
const shapeMarkup = (
  shape: ShapeDefinition,
  paint: string,
  opacity: number,
  transform: string,
  filterAttr: string = '',
  offsetX = 0,
  offsetY = 0,
  blendMode?: BlendMode
): string => {
  const t = transform ? ` transform="${transform}"` : '';
  const f = filterAttr ? ` ${filterAttr}` : '';
  const b = blendModeAttr(blendMode);
  const common = `fill="${paint}" opacity="${opacity}"${t}${f}${b}`;
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

  const rx = shape.cornerRadius ?? 0;
  return `<rect x="${ox}" y="${oy}" width="${shape.width}" height="${shape.height}" rx="${rx}" ${common}/>\n`;
};

/**
 * Approximate an angular (conic) or diamond gradient with primitive shapes.
 * Used because SVG has no conic gradient; the caller clips the result to the
 * shape (or the canvas rect).
 */
const approximationMarkup = (fill: GradientFill, shape: ShapeDefinition, steps = 180): string => {
  const w = shape.width;
  const h = shape.height;
  const cx = w * ((fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient' ? fill.centerX : 0.5) ?? 0.5);
  const cy = h * ((fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient' ? fill.centerY : 0.5) ?? 0.5);

  if (fill.kind === 'diamond-gradient') {
    const reach = Math.max(w, h) * (fill.radius ?? 0.5);
    let out = `<rect x="0" y="0" width="${w}" height="${h}" fill="${sampleStops(fill.stops, 1)}"/>`;
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

  for (const layer of visible) {
    const opacity = layer.opacity;
    const transformAttr = layerTransformAttr(canvas, layer.transform);

    // Build SVG filter for this layer if it has an imageFilter
    const filterId = nextId(`filter-${layer.id}`);
    const filterMarkup = imageFilterToSvgFilter(layer.imageFilter, filterId);
    if (filterMarkup) defs.push(filterMarkup);
    const filterAttr = filterMarkup ? ` filter="url(#${filterId})"` : '';

    if (layer.kind === 'text' && layer.text) {
      const fill = layer.fill;
      if (!fill || fill.kind === 'none') continue;
      let paint: string;
      if (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient') {
        paint = sampleStops(fill.stops, 0);
      } else {
        const resolved = paintFor(fill, nextId(`text-${layer.id}`));
        if (!resolved) continue;
        if (resolved.defs) defs.push(resolved.defs);
        paint = resolved.paint;
      }
      // Canvas draws text at the canvas centre (`fillText(content, S/2, S/2)`)
      // with the layer transform already applied around that same centre.
      //
      // `content` e `fontFamily` vêm do `.iconcore.json` da pessoa e são escapados. São as
      // **duas** interpolações deste arquivo que recebem dado do usuário — as demais são
      // números e valores derivados (`fontSize`, `fontWeight`, `paint`, offsets). Sem o
      // escape, `AT&T` produz XML malformado que nenhum leitor abre, e um nome de família
      // com aspas fecha o atributo. Ver `escapeXml.ts` para o porquê de uma função só.
      svgLayers += `<text x="${canvas.width / 2}" y="${canvas.height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(layer.text.fontFamily)}" font-size="${layer.text.fontSize}" font-weight="${layer.text.fontWeight}" fill="${paint}" opacity="${opacity}" transform="${transformAttr}"${filterAttr}>${escapeXml(layer.text.content)}</text>\n`;
      continue;
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
          svgLayers += `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>${scoped}</g>\n`;
          continue;
        }
        // The Canvas2D backend draws the asset into the layer rectangle, so the
        // SVG export must place it in the same rectangle: pin the document's
        // viewport to its intrinsic size, then map that onto the rect. Without
        // this, PNG and SVG exports of the same project disagreed.
        const layerRect = layerBaseRect({ source: layer.source }, canvas, natural);
        const placement =
          `translate(${layerRect.cx - layerRect.w / 2},${layerRect.cy - layerRect.h / 2}) ` +
          `scale(${layerRect.w / natural.width},${layerRect.h / natural.height})`;
        svgLayers +=
          `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>` +
          `<g transform="${placement}">${setSvgViewport(scoped, natural.width, natural.height)}</g>` +
          `</g>\n`;
      } catch {
        // Skip layers with invalid base64
      }
      continue;
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
        svgLayers +=
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
      continue;
    }

    const shape = layer.source.shape;
    if (!shape) continue;

    const fill = layer.fill;
    // A shape with no paint (missing fill or `kind: 'none'`) is transparent.
    if (!fill || fill.kind === 'none') continue;

    if (fill.kind === 'angular-gradient' || fill.kind === 'diamond-gradient') {
      const clipId = nextId(`clip-${layer.id}`);
      defs.push(`<clipPath id="${clipId}">${shapeMarkup(shape, '#000000', 1, '')}</clipPath>`);
      // The approximation stands in for a conic/diamond gradient, and it inherits
      // the layer's blend mode too — otherwise a layer with both would lose the
      // blend in SVG while keeping it on canvas.
      svgLayers += `<g opacity="${opacity}" transform="${transformAttr}" clip-path="url(#${clipId})"${filterAttr}${blendModeAttr(layer.blendMode)}>${approximationMarkup(fill, shape)}</g>\n`;
      continue;
    }

    const resolved = paintFor(fill, nextId(`fill-${layer.id}`));
    if (!resolved) continue;
    if (resolved.defs) defs.push(resolved.defs);
    // Centred like the Canvas2D compositor: `((S - w) / 2, (S - h) / 2)`.
    svgLayers += shapeMarkup(
      shape,
      resolved.paint,
      opacity,
      transformAttr,
      filterAttr,
      (canvas.width - shape.width) / 2,
      (canvas.height - shape.height) / 2,
      layer.blendMode
    );
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
