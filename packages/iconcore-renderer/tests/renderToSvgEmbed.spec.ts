import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill, IconLayer } from '@iconcore/shared';
import { renderToSvg, renderToSvgWithOptions } from '../src/renderToSvg';

const solidFill: Fill = { kind: 'solid', color: '#ffffff' };

const rasterLayer = (): IconLayer => ({
  id: 'img-1',
  name: 'Photo',
  kind: 'image',
  visible: true,
  zIndex: 1,
  source: { type: 'inline', mimeType: 'image/png', data: 'abc' },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1
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

describe('renderToSvgWithOptions — raster image embedding (ADR-014 §7)', () => {
  it('embeds a raster image layer as a data: URI, positioned like the PNG backend', () => {
    const project = createProject([rasterLayer()]);
    const result = renderToSvgWithOptions(project, 'default', {
      imageSizes: new Map([['img-1', { width: 64, height: 64 }]])
    });

    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('<image');
    expect(result.svg).toContain('href="data:image/png;base64,abc"');
    // contain-fit inside the 128 canvas: 64 -> scale 2
    expect(result.svg).toContain('scale(2,2)');
  });

  it('prefers the layer shape rectangle when present (same rule as inline SVG)', () => {
    const layer = rasterLayer();
    layer.source.shape = { kind: 'rectangle', width: 40, height: 40 };
    const project = createProject([layer]);
    const result = renderToSvgWithOptions(project, 'default', {
      imageSizes: new Map([['img-1', { width: 64, height: 64 }]])
    });

    // rect 40x40 mapped onto natural 64 → 40/64
    expect(result.svg).toContain('scale(0.625,0.625)');
  });

  it('warns when a raster image layer has no resolvable size', () => {
    const project = createProject([rasterLayer()]);
    const result = renderToSvgWithOptions(project, 'default', { skipImages: false });

    expect(result.svg).not.toContain('<image');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Photo');
    expect(result.warnings[0]).toContain('omitted');
  });

  it('respects skipImages (opt-out per artifact): omits silently, no warning', () => {
    const project = createProject([rasterLayer()]);
    const result = renderToSvgWithOptions(project, 'default', {
      imageSizes: new Map([['img-1', { width: 64, height: 64 }]]),
      skipImages: true
    });

    expect(result.svg).not.toContain('<image');
    expect(result.warnings).toEqual([]);
  });

  it('alerts when an embedded image exceeds the byte threshold', () => {
    const project = createProject([rasterLayer()]);
    const result = renderToSvgWithOptions(project, 'default', {
      imageSizes: new Map([['img-1', { width: 64, height: 64 }]]),
      maxEmbeddedImageBytes: 2 // 'abc' ≈ 3 bytes
    });

    expect(result.svg).toContain('<image');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Photo');
    expect(result.warnings[0]).toContain('limit: 2');
  });

  it('keeps inline SVG layers on their existing path (unaffected by embedding)', () => {
    const svgLayer: IconLayer = {
      id: 'svg-1',
      name: 'Vector best',
      kind: 'svg',
      visible: true,
      zIndex: 1,
      source: { type: 'inline', mimeType: 'image/svg+xml', data: btoa('<svg><rect width="48" height="24" fill="red"/></svg>') },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1
    };
    const project = createProject([svgLayer]);
    const result = renderToSvgWithOptions(project, 'default', {});

    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('<rect');
  });
});

describe('renderToSvg — legacy behaviour', () => {
  it('returns a string and still omits raster image layers silently', () => {
    const project = createProject([rasterLayer()]);
    const svg = renderToSvg(project, 'default');

    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<image');
  });
});