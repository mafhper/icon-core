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

  it('does not need isolation: the <svg> root is already a stacking context', () => {
    // This asserted the opposite once, on the reasoning that `mix-blend-mode`
    // reaches past the artwork. Measured, it does not: rendering the same blend
    // over a black page and over a red page produced byte-identical pixels. The
    // assertion stays as a negative so the attribute does not come back with its
    // plausible-sounding rationale.
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }),
        shapeLayer({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }, {
          blendMode: 'multiply'
        })
      ])
    );

    expect(svg).toContain('mix-blend-mode:multiply');
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

describe('conic/diamond approximation centring', () => {
  // Regression measured on the owner's sample set: this branch was the only
  // one that skipped the compositor's `(S − w) / 2` centring, so the clipPath
  // and the wedges stayed at the local origin while every sibling branch
  // centred — the exported SVG shifted the artwork by −66px on a 512 canvas.
  // (256 − 180) / 2 = 38; the wedge centre lands at 38 + 90 = 128.

  it('places the clip and the conic wedges in canvas space', () => {
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 180, height: 180, cornerRadius: 0 }, {
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

    // The clip shares the wedges' coordinate space, and both are centred.
    expect(svg).toContain('<rect x="38" y="38" width="180" height="180"');
    expect(svg).toContain('M 128 128');
    // The old local-origin form, kept as a negative so it cannot come back.
    expect(svg).not.toContain('M 90 90');
  });

  it('places the diamond base and its reach in canvas space', () => {
    const svg = render(
      project([
        shapeLayer({ kind: 'rectangle', width: 180, height: 180, cornerRadius: 0 }, {
          fill: {
            kind: 'diamond-gradient',
            centerX: 0.5,
            centerY: 0.5,
            radius: 0.5,
            stops: [
              { offset: 0, color: '#ffffff' },
              { offset: 1, color: '#111827' }
            ]
          }
        })
      ])
    );

    // Base square at (38, 38); the outer diamond still starts at
    // reach = max(w, h) * 0.5 = 90 around the centred (128, 128).
    expect(svg).toContain('<rect x="38" y="38" width="180" height="180"');
    expect(svg).toContain('points="128,38 218,128 128,218 38,128"');
  });
});

describe('linear gradient span', () => {
  // The canvas compositor builds the gradient line with the CSS length
  // `half = (w·|dx| + h·|dy|) / 2` (`buildGradient` in `backends/canvas.ts`).
  // The SVG emitter used `50 ± dx·50` — half the bbox projection — so for a
  // diagonal the stops spanned 0.707 of the line and the export did not match
  // the editor. These pin the gradient line's endpoints in percent of the
  // bounding box, which is the quantity `objectBoundingBox` transforms; a
  // smooth-gradient pixel average hid the defect instead of showing it.
  const gradientSvg = (angle: number) =>
    render(
      project([
        shapeLayer({ kind: 'rectangle', width: 208, height: 208, cornerRadius: 0 }, {
          fill: {
            kind: 'linear-gradient',
            angle,
            stops: [
              { offset: 0, color: '#ff5722' },
              { offset: 1, color: '#2196f3' }
            ]
          }
        })
      ])
    );

  it('spans the whole diagonal of a square at 45°, as the canvas does', () => {
    // A 45° gradient line in a square runs corner to corner: bottom-left
    // (0%, 100%) to top-right (100%, 0%). The compressed form was
    // 14.65% → 85.36%, which is the side length, not the diagonal.
    expect(gradientSvg(45)).toContain('x1="0.00%" y1="100.00%" x2="100.00%" y2="0.00%"');
  });

  it('keeps the span it always had for the axis-aligned angles', () => {
    // 0 = to top: vertical line, full height, centred horizontally.
    expect(gradientSvg(0)).toContain('x1="50.00%" y1="100.00%" x2="50.00%" y2="0.00%"');
    // 90 = to right: horizontal line, full width, centred vertically.
    expect(gradientSvg(90)).toContain('x1="0.00%" y1="50.00%" x2="100.00%" y2="50.00%"');
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
