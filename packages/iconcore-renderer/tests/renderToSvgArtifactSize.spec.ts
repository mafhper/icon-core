import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill, IconLayer, ImageFilter, ExportFormat } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';
import { namespaceSvgIds } from '../src/svgSize';

const solid: Fill = { kind: 'solid', color: '#ffffff' };

const projectWith = (layers: IconLayer[], canvasSize = 512): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: canvasSize, background: solid },
  layers,
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
});

const shapeLayer = (filter?: ImageFilter): IconLayer => ({
  id: 'shape-1',
  name: 'Shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'inline', shape: { kind: 'rectangle', width: 64, height: 64 }, mimeType: 'image/svg+xml', data: '' },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#ff0000' },
  imageFilter: filter
});

/** A stand-in for an imported asset that defines its own short ids. */
const importedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
<defs><linearGradient id="a"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#00f"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#a)"/>
<use xlink:href="#a"/>
</svg>`;

const svgLayer = (id: string): IconLayer => ({
  id,
  name: id,
  kind: 'svg',
  visible: true,
  zIndex: 1,
  source: { type: 'inline', mimeType: 'image/svg+xml', data: btoa(importedSvg) },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1
});

describe('export size — the artifact spec owns the SVG dimensions (D3)', () => {
  it('renders at the canvas size when no size is requested', () => {
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()]), 'default').svg;
    expect(svg).toContain('width="512" height="512" viewBox="0 0 512 512"');
  });

  it('honours a requested size of 1024 (what the web/electron presets ask for)', () => {
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()]), 'default', { size: 1024 }).svg;
    expect(svg).toContain('width="1024" height="1024" viewBox="0 0 512 512"');
  });

  it('keeps the viewBox in canvas units so the geometry does not scale', () => {
    // The artwork must stay at canvas coordinates; only the document scales.
    // If the viewBox moved to 1024 the layer would sit at the wrong place.
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()]), 'default', { size: 1024 }).svg;
    expect(svg).toContain('<rect x="224" y="224" width="64" height="64"');
    expect(svg).not.toContain('viewBox="0 0 1024 1024"');
  });

  it('matches the raster path: canvas geometry, requested pixel size', () => {
    // encodeRaster renders at canvas.size then resamples to the artifact size.
    // The SVG must describe the same picture at that pixel size.
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()]), 'default', { size: 1024 }).svg;
    expect(svg).toMatch(/width="1024" height="1024"/);
    expect(svg).toMatch(/viewBox="0 0 512 512"/);
  });

  it('ignores a non-positive size instead of emitting a zero-sized document', () => {
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()]), 'default', { size: 0 }).svg;
    expect(svg).toContain('width="512" height="512"');
  });

  it('still applies colour filters in a 1024 artifact (the web-svg/electron-svg case)', () => {
    const svg = renderToSvgWithOptions(projectWith([shapeLayer({ hue: 142, saturation: 150 })]), 'default', {
      size: 1024
    }).svg;

    // Derive the filter id instead of hardcoding it: `nextId` is a running
    // counter, so the suffix depends on how many defs were emitted first.
    const id = /<filter id="(filter-shape-1-\d+)"/.exec(svg)?.[1];
    expect(id).toBeTruthy();
    expect(svg).toContain('hueRotate');
    expect(svg).toContain('saturate');
    expect(svg).toContain(`filter="url(#${id})"`);
    expect(svg).toContain('width="1024"');
  });

  it('scales a 256 canvas up to 1024 as well', () => {
    const svg = renderToSvgWithOptions(projectWith([shapeLayer()], 256), 'default', { size: 1024 }).svg;
    expect(svg).toContain('width="1024" height="1024" viewBox="0 0 256 256"');
  });
});

describe('id namespacing for embedded SVG (D4)', () => {
  it('prefixes ids and rewrites url(#…) references', () => {
    const out = namespaceSvgIds(importedSvg, 'l1');
    expect(out).toContain('id="l1-a"');
    expect(out).toContain('fill="url(#l1-a)"');
    expect(out).not.toContain('id="a"');
  });

  it('rewrites xlink:href and href fragments', () => {
    const out = namespaceSvgIds(importedSvg, 'l1');
    expect(out).toContain('xlink:href="#l1-a"');
  });

  it('leaves colour literals alone', () => {
    const out = namespaceSvgIds(importedSvg, 'l1');
    expect(out).toContain('stop-color="#0f0"');
    expect(out).toContain('stop-color="#00f"');
  });

  it('is a no-op without a prefix', () => {
    expect(namespaceSvgIds(importedSvg, '')).toBe(importedSvg);
  });

  it('two layers importing the same asset do not collide', () => {
    // Both layers define `id="a"`. Before the fix the second layer's
    // `url(#a)` would resolve to the first layer's gradient.
    const svg = renderToSvgWithOptions(projectWith([svgLayer('one'), svgLayer('two')]), 'default').svg;

    expect(svg).toContain('id="lone-a"');
    expect(svg).toContain('id="ltwo-a"');
    // Every reference must point at a definition that exists in this document.
    const defined = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const referenced = [...svg.matchAll(/url\(#([^)\s]+)\)/g)].map((m) => m[1]);
    const dangling = referenced.filter((id) => !defined.has(id));
    expect(dangling).toEqual([]);
  });

  it('does not collide with the exporter own defs', () => {
    const svg = renderToSvgWithOptions(
      projectWith([shapeLayer({ hue: 10 }), svgLayer('one')]),
      'default'
    ).svg;
    const defined = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

    const filterId = /<filter id="(filter-shape-1-\d+)"/.exec(svg)?.[1];
    expect(filterId).toBeTruthy();
    expect(defined.has(filterId!)).toBe(true);
    expect(defined.has('lone-a')).toBe(true);
    // The bare id from the imported asset must be gone, or it could still
    // collide with a sibling layer.
    expect(defined.has('a')).toBe(false);
  });
});

// Keeps the unused-import lint honest about the shared format union.
export type _Format = ExportFormat;