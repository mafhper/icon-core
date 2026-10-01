import type { Fill, GradientFill, IconCoreProject, IconLayer, IconVariant, ShapeDefinition, ImageFilter } from '@iconcore/shared';
import { toRgba } from './color';
import { layerBaseRect } from './geometry';
import { conicStartRadians, cssAngleVector, expandStopsDetailed, sampleStops } from './gradient';
import { parseSvgIntrinsicSize, setSvgViewport } from './svgSize';

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
const layerTransformAttr = (size: number, transform: IconLayer['transform']): string => {
  const half = size / 2;
  const { x = 0, y = 0, scale = 1, rotation = 0 } = transform ?? {};
  return (
    `translate(${half + x},${half + y}) ` +
    `rotate(${rotation}) ` +
    `scale(${scale}) ` +
    `translate(${-half},${-half})`
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
  offsetY = 0
): string => {
  const t = transform ? ` transform="${transform}"` : '';
  const f = filterAttr ? ` ${filterAttr}` : '';
  const common = `fill="${paint}" opacity="${opacity}"${t}${f}`;
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

  const rx = shape.kind === 'squircle' ? shape.width * 0.25 : shape.cornerRadius ?? 0;
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

  const size = project.canvas.size;
  const bg = project.variants[variant]?.canvas?.background ?? project.canvas.background;

  const defs: string[] = [];
  let idSeq = 0;
  const nextId = (prefix: string): string => `${prefix}-${idSeq++}`;

  // --- background ---------------------------------------------------------
  let bgMarkup = '';
  if (bg.kind !== 'none') {
    const rect: ShapeDefinition = { kind: 'rectangle', width: size, height: size };
    if (bg.kind === 'angular-gradient' || bg.kind === 'diamond-gradient') {
      const clipId = nextId('bg-clip');
      defs.push(`<clipPath id="${clipId}"><rect width="${size}" height="${size}"/></clipPath>`);
      bgMarkup = `<g clip-path="url(#${clipId})">${approximationMarkup(bg, rect)}</g>\n`;
    } else {
      const paint = paintFor(bg, nextId('bg'));
      if (paint) {
        if (paint.defs) defs.push(paint.defs);
        bgMarkup = `<rect width="${size}" height="${size}" fill="${paint.paint}"/>\n`;
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
    const transformAttr = layerTransformAttr(size, layer.transform);

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
      svgLayers += `<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${layer.text.fontFamily}" font-size="${layer.text.fontSize}" font-weight="${layer.text.fontWeight}" fill="${paint}" opacity="${opacity}" transform="${transformAttr}"${filterAttr}>${layer.text.content}</text>\n`;
      continue;
    }

    if (layer.source.type === 'inline' && layer.source.data && layer.source.mimeType === 'image/svg+xml') {
      try {
        const svgContent = atob(layer.source.data);
        const natural = parseSvgIntrinsicSize(svgContent);
        if (!natural) {
          // No intrinsic size to align with: embed as-is (previous behaviour).
          svgLayers += `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>${svgContent}</g>\n`;
          continue;
        }
        // The Canvas2D backend draws the asset into the layer rectangle, so the
        // SVG export must place it in the same rectangle: pin the document's
        // viewport to its intrinsic size, then map that onto the rect. Without
        // this, PNG and SVG exports of the same project disagreed.
        const layerRect = layerBaseRect({ source: layer.source }, size, natural);
        const placement =
          `translate(${layerRect.cx - layerRect.w / 2},${layerRect.cy - layerRect.h / 2}) ` +
          `scale(${layerRect.w / natural.width},${layerRect.h / natural.height})`;
        svgLayers +=
          `<g opacity="${opacity}" transform="${transformAttr}"${filterAttr}>` +
          `<g transform="${placement}">${setSvgViewport(svgContent, natural.width, natural.height)}</g>` +
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
        const layerRect = layerBaseRect({ source: layer.source }, size, natural);
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
      svgLayers += `<g opacity="${opacity}" transform="${transformAttr}" clip-path="url(#${clipId})"${filterAttr}>${approximationMarkup(fill, shape)}</g>\n`;
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
      (size - shape.width) / 2,
      (size - shape.height) / 2
    );
  }

  const defsBlock = defs.length > 0 ? `  <defs>\n    ${defs.join('\n    ')}\n  </defs>\n` : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${defsBlock}${bgMarkup}${svgLayers}
</svg>`;

  return { svg, warnings };
};
