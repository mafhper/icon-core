import type { Fill, IconCoreProject, IconLayer, IconVariant } from '@iconcore/shared';

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

/**
 * SVG paint for a Fill. Returns `null` when there is nothing to paint
 * (`kind: 'none'`) so callers can skip the element entirely instead of falling
 * back to an opaque colour.
 */
const paintFor = (fill: Fill | undefined, id: string): { defs: string; paint: string } | null => {
  if (!fill || fill.kind === 'none') return null;

  if (fill.kind === 'solid') {
    return { defs: '', paint: fill.color ?? '#ffffff' };
  }

  const stops = (fill.stops ?? [])
    .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`)
    .join('');

  if (fill.kind === 'linear-gradient') {
    const angle = ((fill.angle ?? 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x1 = (50 - cos * 50).toFixed(2);
    const y1 = (50 - sin * 50).toFixed(2);
    const x2 = (50 + cos * 50).toFixed(2);
    const y2 = (50 + sin * 50).toFixed(2);
    return {
      defs: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`,
      paint: `url(#${id})`
    };
  }

  const cx = ((fill.centerX ?? 0.5) * 100).toFixed(2);
  const cy = ((fill.centerY ?? 0.5) * 100).toFixed(2);
  const r = ((fill.radius ?? 0.5) * 100).toFixed(2);
  return {
    defs: `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%">${stops}</radialGradient>`,
    paint: `url(#${id})`
  };
};

export const renderToSvg = (
  project: IconCoreProject,
  variant: IconVariant
): string => {
  const size = project.canvas.size;
  const bg = project.variants[variant]?.canvas?.background ?? project.canvas.background;

  const defs: string[] = [];
  const bgPaint = paintFor(bg, 'bg-background');
  if (bgPaint?.defs) defs.push(bgPaint.defs);

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

    if (layer.kind === 'text' && layer.text) {
      const textPaint = paintFor(layer.fill, `text-${layer.id}`);
      if (textPaint?.defs) defs.push(textPaint.defs);
      if (!textPaint) continue; // no paint → nothing to draw
      svgLayers += `<text x="${size / 2 + tx}" y="${size / 2 + ty}" text-anchor="middle" dominant-baseline="middle" font-family="${layer.text.fontFamily}" font-size="${layer.text.fontSize}" font-weight="${layer.text.fontWeight}" fill="${textPaint.paint}" opacity="${opacity}" transform="rotate(${transform.rotation},${size / 2 + tx},${size / 2 + ty}) scale(${s})">${layer.text.content}</text>\n`;
    } else if (layer.source.type === 'inline' && layer.source.data && layer.source.mimeType === 'image/svg+xml') {
      try {
        const svgContent = atob(layer.source.data);
        svgLayers += `<g opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})">${svgContent}</g>\n`;
      } catch {
        // Skip layers with invalid base64
      }
    } else if (layer.source.shape) {
      const shape = layer.source.shape;
      const fillPaint = paintFor(layer.fill, `fill-${layer.id}`);
      if (fillPaint?.defs) defs.push(fillPaint.defs);
      // A shape with no paint (missing fill or `kind: 'none'`) is transparent:
      // skip it rather than defaulting to black.
      if (!fillPaint) continue;
      const fillColor = fillPaint.paint;
      if (shape.kind === 'circle') {
        const r = Math.min(shape.width, shape.height) / 2;
        svgLayers += `<circle cx="${shape.width / 2}" cy="${shape.height / 2}" r="${r}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'rectangle' || shape.kind === 'rounded-rectangle') {
        const rx = shape.cornerRadius ?? 0;
        svgLayers += `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${rx}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'squircle') {
        svgLayers += `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${shape.width * 0.25}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'triangle') {
        svgLayers += `<polygon points="${shape.width / 2},0 ${shape.width},${shape.height} 0,${shape.height}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'line') {
        svgLayers += `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${Math.min(shape.width, shape.height) / 2}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'star') {
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
        svgLayers += `<polygon points="${pts.join(' ')}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      }
    }
  }

  const defsBlock = defs.length > 0 ? `  <defs>\n    ${defs.join('\n    ')}\n  </defs>\n` : '';
  const bgRect = bgPaint ? `  <rect width="${size}" height="${size}" fill="${bgPaint.paint}"/>\n` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${defsBlock}${bgRect}${svgLayers}
</svg>`;
};
