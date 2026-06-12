import type { IconCoreProject, IconVariant } from '@iconcore/shared';

export const renderToSvg = (
  project: IconCoreProject,
  variant: IconVariant
): string => {
  const size = project.canvas.size;
  const bg = project.canvas.background;

  let bgColor = '#ffffff';
  if (bg.kind === 'solid' && bg.color) {
    bgColor = bg.color;
  }

  const visible = project.layers
    .filter(l => l.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  let svgLayers = '';

  for (const layer of visible) {
    const variantOverrides = layer.variantOverrides?.[variant];
    const opacity = variantOverrides?.opacity ?? layer.opacity;
    const transform = layer.transform;
    const tx = transform?.x ?? 0;
    const ty = transform?.y ?? 0;
    const s = transform?.scale ?? 1;

    if (layer.source.type === 'inline' && layer.source.data && layer.source.mimeType === 'image/svg+xml') {
      try {
        const svgContent = atob(layer.source.data);
        svgLayers += `<g opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})">${svgContent}</g>\n`;
      } catch {
        // Skip layers with invalid base64
      }
    } else if (layer.source.shape) {
      const shape = layer.source.shape;
      const fillColor = layer.fill?.color ?? '#000000';
      if (shape.kind === 'circle') {
        const r = Math.min(shape.width, shape.height) / 2;
        svgLayers += `<circle cx="${shape.width / 2}" cy="${shape.height / 2}" r="${r}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'rectangle' || shape.kind === 'rounded-rectangle') {
        const rx = shape.cornerRadius ?? 0;
        svgLayers += `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${rx}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      } else if (shape.kind === 'squircle') {
        svgLayers += `<rect x="0" y="0" width="${shape.width}" height="${shape.height}" rx="${shape.width * 0.25}" fill="${fillColor}" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${s})"/>\n`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bgColor}"/>
${svgLayers}
</svg>`;
};