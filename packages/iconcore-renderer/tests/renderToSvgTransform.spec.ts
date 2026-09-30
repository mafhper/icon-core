import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill, IconLayer } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

/**
 * IC51 — the SVG export used to place layers with a transform around the
 * *origin* (`translate(x,y) scale(s)`) while the Canvas2D compositor pivots
 * around the *canvas centre*. Any project with `scale ≠ 1` therefore exported
 * artwork outside the viewBox, visibly cropped.
 *
 * These tests reproduce the geometry of the project from the bug report and
 * assert the two pipelines agree, by mapping the emitted SVG transform over
 * the layer rect instead of trusting the string.
 */

type Matrix = [number, number, number, number, number, number];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
];

const applyMatrix = (m: Matrix, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5]
});

/** Minimal `translate()/rotate()/scale()` evaluator — enough for our own output. */
const parseTransform = (src: string): Matrix => {
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const re = /(translate|rotate|scale)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    const n = match[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (match[1] === 'translate') m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0]);
    else if (match[1] === 'scale') m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0]);
    else {
      const rad = (n[0] * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      m = mul(m, [cos, sin, -sin, cos, 0, 0]);
    }
  }
  return m;
};

/** Bounding box of the transformed layer rect, in canvas coordinates. */
const transformedRect = (svg: string) => {
  const hit = svg.match(
    /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*transform="([^"]+)"/
  );
  if (!hit) throw new Error(`no transformed layer rect in:\n${svg}`);
  const [, xs, ys, ws, hs, ts] = hit;
  const x = Number(xs);
  const y = Number(ys);
  const w = Number(ws);
  const h = Number(hs);
  const m = parseTransform(ts);
  const corners = [
    applyMatrix(m, x, y),
    applyMatrix(m, x + w, y),
    applyMatrix(m, x, y + h),
    applyMatrix(m, x + w, y + h)
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxY: Math.max(...corners.map((c) => c.y))
  };
};

const solid: Fill = { kind: 'solid', color: '#ffffff' };

const projectWith = (
  size: number,
  shape: { width: number; height: number },
  transform: { x: number; y: number; scale: number; rotation: number }
): IconCoreProject => {
  const layer: IconLayer = {
    id: 'shape-1',
    name: 'Shape',
    kind: 'shape',
    visible: true,
    zIndex: 0,
    source: { type: 'inline', shape: { kind: 'rectangle', ...shape }, mimeType: 'image/svg+xml', data: '' },
    transform,
    opacity: 1,
    fill: { kind: 'solid', color: '#ff0000' }
  };
  return {
    schemaVersion: 3,
    metadata: { name: 'Test', shortName: 'Test' },
    canvas: { size, background: solid },
    layers: [layer],
    variants: { default: {} },
    targets: [{ target: 'web-favicon', enabled: true }],
    exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
  };
};

/** Where the Canvas2D compositor would put the same layer (composeLayers). */
const canvasRect = (
  size: number,
  shape: { width: number; height: number },
  t: { x: number; y: number; scale: number; rotation: number }
) => {
  const c = size / 2;
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  return {
    minX: c + t.x - halfW * t.scale,
    maxX: c + t.x + halfW * t.scale,
    minY: c + t.y - halfH * t.scale,
    maxY: c + t.y + halfH * t.scale
  };
};

describe('IC51 — SVG export transform matches the Canvas2D compositor', () => {
  it('reproduces the bug report: scale 2.43 lands where the PNG actually rendered', () => {
    // From Downloads\logo-icons: canvas 512, layer rect 199.68 (square),
    // transform { x: 0, y: 0, scale: 2.43 }. The exported PNG's measured
    // content bbox was X[13..498] Y[13..498].
    const size = 512;
    const shape = { width: 199.68, height: 199.68 };
    const transform = { x: 0, y: 0, scale: 2.43, rotation: 0 };

    const svg = renderToSvgWithOptions(projectWith(size, shape, transform), 'default').svg;
    const box = transformedRect(svg);

    expect(box.minX).toBeCloseTo(13.39, 1);
    expect(box.maxX).toBeCloseTo(498.61, 1);
    expect(box.minY).toBeCloseTo(13.39, 1);
    expect(box.maxY).toBeCloseTo(498.61, 1);
  });

  it('keeps the artwork inside the viewBox (the reported "cut" symptom)', () => {
    const size = 512;
    const shape = { width: 199.68, height: 199.68 };
    const svg = renderToSvgWithOptions(
      projectWith(size, shape, { x: 0, y: 0, scale: 2.43, rotation: 0 }),
      'default'
    ).svg;
    const box = transformedRect(svg);

    expect(box.minX).toBeGreaterThanOrEqual(0);
    expect(box.minY).toBeGreaterThanOrEqual(0);
    expect(box.maxX).toBeLessThanOrEqual(size);
    expect(box.maxY).toBeLessThanOrEqual(size);
  });

  it('agrees with the canvas for scale, offset and rotation combined', () => {
    const size = 512;
    const shape = { width: 120, height: 80 };
    const cases = [
      { x: 0, y: 0, scale: 1, rotation: 0 },
      { x: 0, y: 0, scale: 2.43, rotation: 0 },
      { x: 40, y: -25, scale: 1.5, rotation: 0 },
      { x: -60, y: 30, scale: 0.6, rotation: 0 }
    ];
    for (const transform of cases) {
      const svg = renderToSvgWithOptions(projectWith(size, shape, transform), 'default').svg;
      const box = transformedRect(svg);
      const expected = canvasRect(size, shape, transform);
      expect(box.minX, `minX ${JSON.stringify(transform)}`).toBeCloseTo(expected.minX, 6);
      expect(box.maxX, `maxX ${JSON.stringify(transform)}`).toBeCloseTo(expected.maxX, 6);
      expect(box.minY, `minY ${JSON.stringify(transform)}`).toBeCloseTo(expected.minY, 6);
      expect(box.maxY, `maxY ${JSON.stringify(transform)}`).toBeCloseTo(expected.maxY, 6);
    }
  });

  it('centres the shape on the canvas when the transform is the identity', () => {
    const size = 512;
    const shape = { width: 64, height: 64 };
    const svg = renderToSvgWithOptions(
      projectWith(size, shape, { x: 0, y: 0, scale: 1, rotation: 0 }),
      'default'
    ).svg;

    // (512 - 64) / 2 — not the origin, which is where the old markup drew it.
    expect(svg).toContain(`<rect x="224" y="224" width="64" height="64"`);
    const box = transformedRect(svg);
    expect(box.minX).toBeCloseTo(224, 6);
    expect(box.maxX).toBeCloseTo(288, 6);
  });

  it('emits the rotation for shape layers (defect D1)', () => {
    const size = 512;
    const svg = renderToSvgWithOptions(
      projectWith(size, { width: 64, height: 64 }, { x: 0, y: 0, scale: 1, rotation: 30 }),
      'default'
    ).svg;

    expect(svg).toContain('rotate(30)');
  });

  it('emits the same centre-pivoted matrix as the canvas applyTransform', () => {
    const size = 512;
    const svg = renderToSvgWithOptions(
      projectWith(size, { width: 64, height: 64 }, { x: 10, y: 20, scale: 2, rotation: 0 }),
      'default'
    ).svg;

    // translate(256+10, 256+20) rotate(0) scale(2) translate(-256, -256)
    expect(svg).toContain(
      'transform="translate(266,276) rotate(0) scale(2) translate(-256,-256)"'
    );
  });
});
