import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill, IconLayer, ShapeDefinition } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

/**
 * A `polygon` shape carries its own point list. The SVG exporter had no branch
 * for it, so it fell through to the rectangle fallback: the editor drew the
 * polygon and the exported SVG drew a box, with no warning anywhere. Same class
 * of defect as the transform drift — one pipeline knew something the other did
 * not.
 *
 * The Canvas2D reference is `traceShapePath` in `composeLayers.ts`:
 *   moveTo(x + points[0].x, y + points[0].y) then lineTo for the rest,
 * closed, inside the same clip/fill the other shapes get.
 */

const solid: Fill = { kind: 'solid', color: '#ffffff' };

const projectWith = (shape: ShapeDefinition, canvasSize = 512): IconCoreProject => {
  const layer: IconLayer = {
    id: 'poly-1',
    name: 'Polygon',
    kind: 'shape',
    visible: true,
    zIndex: 0,
    source: { type: 'inline', shape, mimeType: 'image/svg+xml', data: '' },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    fill: { kind: 'solid', color: '#ff0000' }
  };
  return {
    schemaVersion: 3,
    metadata: { name: 'Test', shortName: 'Test' },
    canvas: { size: canvasSize, background: solid },
    layers: [layer],
    variants: { default: {} },
    targets: [{ target: 'web-favicon', enabled: true }],
    exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
  };
};

/** A simple triangle expressed as a polygon point list. */
const triangle = (width: number, height: number): ShapeDefinition => ({
  kind: 'polygon',
  width,
  height,
  points: [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height }
  ]
});

describe('renderToSvg — polygon shapes (parity with the Canvas2D compositor)', () => {
  it('emits a polygon element, not the rectangle fallback', () => {
    const size = 512;
    const shape = triangle(60, 40);
    const svg = renderToSvgWithOptions(projectWith(shape, size), 'default').svg;

    // The shape is centred like every other layer, then offset by its own points.
    const ox = (size - shape.width) / 2;
    const oy = (size - shape.height) / 2;
    const expected = shape.points!.map((p) => `${ox + p.x},${oy + p.y}`).join(' ');

    expect(svg).toContain(`<polygon points="${expected}"`);
  });

  it('does not fall back to a rectangle', () => {
    const svg = renderToSvgWithOptions(projectWith(triangle(60, 40)), 'default').svg;

    // A solid background does emit a `<rect>`, but it spans the canvas and has
    // no `x`. The layer's fallback rect would be positioned and transformed, so
    // `<rect x=` is the thing that must not appear.
    expect(svg).not.toContain('<rect x=');
    expect(svg).toContain('<rect width="512"');
  });

  it('respects the layer transform like any other shape', () => {
    const size = 512;
    const shape = triangle(60, 40);
    const project = projectWith(shape, size);
    project.layers[0].transform = { x: 25, y: -10, scale: 2, rotation: 0 };

    const svg = renderToSvgWithOptions(project, 'default').svg;

    expect(svg).toContain(
      'transform="translate(281,246) rotate(0) scale(2) translate(-256,-256)"'
    );
    expect(svg).toContain('<polygon points=');
  });

  it('still renders the rectangle fallback when a polygon has no points', () => {
    // Mirrors `traceShapePath`: it requires `shape.points?.length`, so a
    // polygon without points rects on the Canvas too.
    const shape: ShapeDefinition = { kind: 'polygon', width: 60, height: 40 };
    const svg = renderToSvgWithOptions(projectWith(shape), 'default').svg;

    expect(svg).toContain('<rect x="226" y="236" width="60" height="40"');
  });

  it('leaves the other shape kinds untouched', () => {
    const circle = renderToSvgWithOptions(
      projectWith({ kind: 'circle', width: 60, height: 60 }),
      'default'
    ).svg;
    expect(circle).toContain('<circle');
    expect(circle).not.toContain('<polygon');

    const star = renderToSvgWithOptions(
      projectWith({ kind: 'star', width: 60, height: 60 }),
      'default'
    ).svg;
    expect(star).toContain('<polygon');
  });
});