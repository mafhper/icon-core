import type { Fill, GradientFill, IconCoreProject, IconLayer, IconVariant, ShapeDefinition } from '@iconcore/shared';
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

/** One shape element, filled with `paint`, carrying opacity/transform. */
const shapeMarkup = (
  shape: ShapeDefinition,
  paint: string,
  opacity: number,
  transform: string
): string => {
  const t = transform ? ` transform="${transform}"` : '';
  const common = `fill="${paint}" opacity="${opacity}"${t}`;

  if (shape.kind === 'circle') {
    const r = Math.min(shape.width, shape.height) / 2;
    return `<circle cx="${shape.width / 2}" cy="${shape.height / 2}" r="${r}" ${common}/>\n`;
  }
  if (shape.kind === 'triangle') {
    return `<polygon points="${shape.width / 2},0 ${shape.width},${shape.height} 0,${shape.height}" ${common}/>\n`;
  }
  if (shape.kind === 'line') {
    const rx = Math.min(shape.width, shape.height) / 2;
    return `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${rx}" ${common}/>\n`;
  }
  if (shape.kind === 'star') {
    const cx = shape.width / 2;
    const cy = shape.height / 2;
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

  const rx = shape.kind === 'squircle' ? shape.width * 0.25 : shape.cornerRadius ?? 0;
  return `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${rx}" ${common}/>\n`;
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

export const renderToSvg = (
  project: IconCoreProject,
  variant: IconVariant
): string => {
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
    const transform = layer.transform;
    const tx = transform?.x ?? 0;
    const ty = transform?.y ?? 0;
    const s = transform?.scale ?? 1;
    const transformAttr = `translate(${tx},${ty}) scale(${s})`;

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
      svgLayers += `<text x="${size / 2 + tx}" y="${size / 2 + ty}" text-anchor="middle" dominant-baseline="middle" font-family="${layer.text.fontFamily}" font-size="${layer.text.fontSize}" font-weight="${layer.text.fontWeight}" fill="${paint}" opacity="${opacity}" transform="rotate(${transform.rotation},${size / 2 + tx},${size / 2 + ty}) scale(${s})">${layer.text.content}</text>\n`;
      continue;
    }

    if (layer.source.type === 'inline' && layer.source.data && layer.source.mimeType === 'image/svg+xml') {
      try {
        const svgContent = atob(layer.source.data);
        const natural = parseSvgIntrinsicSize(svgContent);
        if (!natural) {
          // No intrinsic size to align with: embed as-is (previous behaviour).
          svgLayers += `<g opacity="${opacity}" transform="${transformAttr}">${svgContent}</g>\n`;
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
          `<g opacity="${opacity}" transform="${transformAttr}">` +
          `<g transform="${placement}">${setSvgViewport(svgContent, natural.width, natural.height)}</g>` +
          `</g>\n`;
      } catch {
        // Skip layers with invalid base64
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
      svgLayers += `<g opacity="${opacity}" transform="${transformAttr}" clip-path="url(#${clipId})">${approximationMarkup(fill, shape)}</g>\n`;
      continue;
    }

    const resolved = paintFor(fill, nextId(`fill-${layer.id}`));
    if (!resolved) continue;
    if (resolved.defs) defs.push(resolved.defs);
    svgLayers += shapeMarkup(shape, resolved.paint, opacity, transformAttr);
  }

  const defsBlock = defs.length > 0 ? `  <defs>\n    ${defs.join('\n    ')}\n  </defs>\n` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${defsBlock}${bgMarkup}${svgLayers}
</svg>`;
};
