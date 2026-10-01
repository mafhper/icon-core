import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill, IconLayer, ImageFilter } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

const solidFill: Fill = { kind: 'solid', color: '#ffffff' };

const textLayer = (filter?: ImageFilter): IconLayer => ({
  id: 'text-1',
  name: 'Text',
  kind: 'text',
  visible: true,
  zIndex: 1,
  source: { type: 'inline', mimeType: 'image/svg+xml', data: '' },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: solidFill,
  text: { content: 'Hello', fontFamily: 'Arial', fontSize: 24, fontWeight: 400 },
  imageFilter: filter
});

const shapeLayer = (filter?: ImageFilter): IconLayer => ({
  id: 'shape-1',
  name: 'Shape',
  kind: 'shape',
  visible: true,
  zIndex: 1,
  source: { type: 'inline', mimeType: 'image/svg+xml', data: '', shape: { kind: 'rectangle', width: 50, height: 50 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: solidFill,
  imageFilter: filter
});

const createProject = (layers: IconLayer[]): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 128, background: solidFill },
  layers,
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
});

describe('renderToSvg — SVG filters (feColorMatrix)', () => {
  it('generates no filter when imageFilter is undefined', () => {
    const project = createProject([textLayer()]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).not.toContain('<filter');
    expect(result.svg).not.toContain('filter=');
  });

  it('generates no filter when imageFilter has default values', () => {
    const project = createProject([textLayer({ saturation: 100, brightness: 100, contrast: 100 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).not.toContain('<filter');
  });

  it('generates feColorMatrix hueRotate for hue adjustment', () => {
    const project = createProject([textLayer({ hue: 90 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<filter');
    expect(result.svg).toContain('feColorMatrix');
    expect(result.svg).toContain('hueRotate');
    expect(result.svg).toContain('values="90"');
    expect(result.svg).toContain('filter=');
  });

  it('generates feColorMatrix saturate for saturation adjustment', () => {
    const project = createProject([textLayer({ saturation: 150 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<filter');
    expect(result.svg).toContain('feColorMatrix');
    expect(result.svg).toContain('saturate');
    expect(result.svg).toContain('values="1.5"');
  });

  it('generates feComponentTransfer for brightness adjustment', () => {
    const project = createProject([textLayer({ brightness: 120 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<filter');
    expect(result.svg).toContain('feComponentTransfer');
    expect(result.svg).toContain('feFuncR');
    expect(result.svg).toContain('slope="1.2"');
  });

  it('generates feComponentTransfer for contrast adjustment', () => {
    const project = createProject([textLayer({ contrast: 80 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<filter');
    expect(result.svg).toContain('feComponentTransfer');
    expect(result.svg).toContain('feFuncR');
    expect(result.svg).toContain('slope="0.8"');
    expect(result.svg).toContain('intercept');
  });

  it('combines multiple filter primitives in one filter', () => {
    const project = createProject([textLayer({ hue: 45, saturation: 120, brightness: 110, contrast: 90 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<filter');
    expect(result.svg).toContain('hueRotate');
    expect(result.svg).toContain('saturate');
    expect(result.svg).toContain('feComponentTransfer');
    // Should have one filter with multiple primitives
    const filterMatch = result.svg.match(/<filter[^>]*>(.*?)<\/filter>/s);
    expect(filterMatch).toBeTruthy();
    expect(filterMatch![1]).toContain('feColorMatrix');
    expect(filterMatch![1]).toContain('feComponentTransfer');
  });

  it('applies filter to text layer', () => {
    const project = createProject([textLayer({ hue: 180 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<text');
    expect(result.svg).toContain('filter=');
  });

  it('applies filter to shape layer', () => {
    const project = createProject([shapeLayer({ saturation: 50 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('<rect');
    expect(result.svg).toContain('filter=');
  });

  it('generates unique filter IDs for multiple layers', () => {
    const project = createProject([
      textLayer({ hue: 90 }),
      shapeLayer({ hue: 180 })
    ]);
    const result = renderToSvgWithOptions(project, 'default');

    const filterIds = result.svg.match(/id="filter-[^"]+"/g);
    expect(filterIds).toBeTruthy();
    expect(filterIds!.length).toBe(2);
    // IDs should be unique
    expect(new Set(filterIds!).size).toBe(2);
  });

  it('handles negative hue values', () => {
    const project = createProject([textLayer({ hue: -90 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('values="-90"');
  });

  it('handles zero saturation (grayscale)', () => {
    const project = createProject([textLayer({ saturation: 0 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('saturate');
    expect(result.svg).toContain('values="0"');
  });

  it('handles brightness > 200%', () => {
    const project = createProject([textLayer({ brightness: 200 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('slope="2"');
  });

  it('handles contrast > 200%', () => {
    const project = createProject([textLayer({ contrast: 200 })]);
    const result = renderToSvgWithOptions(project, 'default');

    expect(result.svg).toContain('slope="2"');
  });
});
