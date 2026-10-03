/**
 * Parity between the SVG renderer and the canvas compositor.
 *
 * These tests exist because the two pipelines drifted and nothing noticed: the
 * SVG export dropped `blendMode` entirely (`rg -c blend renderToSvg.ts` → 0) and
 * drew a squircle as `<rect rx="width * 0.25">`, which is a different curve.
 * Measured against the canvas backend, that put 15,0% and 10,2% of pixels
 * outside tolerance respectively — visible side by side as a yellow overlap
 * where the editor showed a dark green one, and a rounded rect where the editor
 * showed a superellipse.
 *
 * The assertions are on the **markup**, not on rendered pixels: a unit test
 * cannot rasterise, and a pixel comparison here would need the browser
 * harness. So these pin what the markup must contain, and the harness measures
 * whether the markup is right.
 */
import { describe, expect, it } from 'vitest';

import { renderToSvg } from '../src';

const project = (layers: unknown[], canvas: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' }, ...canvas },
  exportProfile: { outputBaseName: 'p' },
  variants: { default: {} },
  layers,
  targets: []
});

let seq = 0;
const shapeLayer = (shape: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: `l${(seq += 1)}`,
  name: 'shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#1565c0' },
  ...extra
});

const render = (p: unknown) => renderToSvg(p as never, 'default');

describe('squircle', () => {
  it('is drawn as a path, not a rounded rect', () => {
    const svg = render(project([shapeLayer({ kind: 'squircle', width: 200, height: 200, cornerRadius: 44 })]));

    expect(svg).toContain('<path');
    // The old approximation was a quarter of the width; anything carrying `rx`
    // is the rectangle again.
    expect(svg).not.toMatch(/<rect[^>]*rx="50"/);
  });

  it('scales the curve per axis for a non-square shape', () => {
    const svg = render(
      project([shapeLayer({ kind: 'squircle', width: 220, height: 120, cornerRadius: 30 })])
    );

    // The offset is `(extent * (1 - n)) / 2` per axis, n = 0.6: ox = 44 from the
    // 220 width, oy = 24 from the 120 height. Both appear, and they differ —
    // which is the whole point: the square form would have produced 44 for both.
    expect(svg).toContain('M44 0');
    expect(svg).toContain('220 24');
    expect(svg).toContain('0 24');
    expect(svg).not.toContain('220 44');
  });

  it('places the shape with the same centring the compositor uses', () => {
    const svg = render(project([shapeLayer({ kind: 'squircle', width: 200, height: 200, cornerRadius: 44 })]));

    // (256 - 200) / 2 = 28.
    expect(svg).toContain('translate(28 28)');
  });
});

describe('blend mode', () => {
  it('emits mix-blend-mode for a layer that declares one', () => {
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }),
        shapeLayer(
          { kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 },
          { blendMode: 'multiply' }
        )
      ])
    );

    expect(svg).toContain('mix-blend-mode:multiply');
  });

  it('covers every mode the domain allows', () => {
    for (const mode of ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'] as const) {
      const svg = render(
        project([
          shapeLayer({ kind: 'rectangle', width: 100, height: 100, cornerRadius: 0 }, { blendMode: mode })
        ])
      );
      if (mode === 'normal') {
        expect(svg).not.toContain('mix-blend-mode');
      } else {
        expect(svg, mode).toContain(`mix-blend-mode:${mode}`);
      }
    }
  });

  it('omits the attribute for an ordinary layer, so its markup is unchanged', () => {
    const svg = render(project([shapeLayer({ kind: 'rectangle', width: 120, height: 120, cornerRadius: 0 })]));

    expect(svg).not.toContain('mix-blend-mode');
    expect(svg).not.toContain('style=');
  });

  it('isolates the group so the blend cannot reach the page behind it', () => {
    // `mix-blend-mode` blends against the backdrop, which by default includes
    // the background rectangle and whatever the SVG is embedded in. The canvas
    // compositor blends while drawing a layer, so it never reaches the
    // background — without isolation the SVG looks plausible and is wrong.
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }),
        shapeLayer({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }, {
          blendMode: 'multiply'
        })
      ])
    );

    expect(svg).toContain('isolation:isolate');
  });

  it('leaves a document with no blend free of isolation', () => {
    const svg = render(project([shapeLayer({ kind: 'rectangle', width: 120, height: 120, cornerRadius: 0 })]));

    expect(svg).not.toContain('isolation');
  });

  it('applies to the conic/diamond approximation too', () => {
    // The approximation stands in for a gradient SVG has no primitive for, and
    // it used to drop the blend as well.
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 180, height: 180, cornerRadius: 0 }, {
          blendMode: 'multiply',
          fill: {
            kind: 'angular-gradient',
            centerX: 0.5,
            stops: [
              { offset: 0, color: '#ff0000' },
              { offset: 1, color: '#0000ff' }
            ]
          }
        })
      ])
    );

    expect(svg).toContain('mix-blend-mode:multiply');
  });

  it('survives on a squircle, so neither fix can pass alone', () => {
    const svg = render(
      project([
        shapeLayer({ kind: 'squircle', width: 170, height: 170, cornerRadius: 40 }, {
          blendMode: 'multiply'
        })
      ])
    );

    expect(svg).toContain('<path');
    expect(svg).toContain('mix-blend-mode:multiply');
  });
});

describe('rounded rectangle is untouched', () => {
  it('still uses the declared corner radius', () => {
    const svg = render(
      project([shapeLayer({ kind: 'rounded-rectangle', width: 208, height: 208, cornerRadius: 48 })])
    );

    expect(svg).toMatch(/<rect[^>]*rx="48"/);
  });
});
