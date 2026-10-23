/**
 * Stroke, tip control and the second corner level (IC77 Passo 4) — markup
 * contract for the SVG pipeline. The canvas side is exercised by the parity
 * fixtures and the browser smoke; these pin what the vector export must and
 * must not contain.
 */
import { describe, expect, it } from 'vitest';
import { renderToSvg } from '../src';

const project = (layers: unknown[]) => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: true },
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

const render = (layers: unknown[]) => renderToSvg(project(layers) as never, 'default');

describe('smooth corners', () => {
  it('renders a smoothed rounded rectangle as a path, and stays a rect without smoothing', () => {
    const smooth = render([
      shapeLayer({ kind: 'rounded-rectangle', width: 200, height: 140, cornerRadius: 40, cornerSmoothing: 0.6 })
    ]);
    expect(smooth).toContain('<path');
    expect(smooth).not.toMatch(/<rect[^>]*rx="40"/);

    const plain = render([shapeLayer({ kind: 'rounded-rectangle', width: 200, height: 140, cornerRadius: 40 })]);
    expect(plain).toContain('rx="40"');
    expect(plain).not.toContain('stroke=');
  });
});

describe('stroke', () => {
  it('is byte-absent when the layer has none (compat)', () => {
    const svg = render([shapeLayer({ kind: 'rectangle', width: 100, height: 100, cornerRadius: 0 })]);
    expect(svg).not.toContain('stroke=');
  });

  it('emits a centered outline with the cap/join contract', () => {
    const svg = render([
      shapeLayer(
        { kind: 'rectangle', width: 100, height: 100, cornerRadius: 8 },
        { stroke: { color: '#102030', width: 8, alignment: 'center', cap: 'round', join: 'bevel' } }
      )
    ]);
    expect(svg).toContain('stroke-width="8"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="bevel"');
    expect(svg).toContain('stroke-miterlimit="4"');
    expect(svg).toContain('fill="none"');
  });

  it('clips an inside stroke to the shape and masks an outside one', () => {
    const inside = render([
      shapeLayer(
        { kind: 'circle', width: 100, height: 100 },
        { stroke: { color: '#102030', width: 6, alignment: 'inside' } }
      )
    ]);
    expect(inside).toContain('<clipPath');
    expect(inside).toContain('stroke-width="12"');

    const outside = render([
      shapeLayer(
        { kind: 'circle', width: 100, height: 100 },
        { stroke: { color: '#102030', width: 6, alignment: 'outside' } }
      )
    ]);
    expect(outside).toContain('<mask');
    expect(outside).toContain('stroke-width="12"');
  });

  it('paints a hollow shape: no fill, only the outline', () => {
    const svg = render([
      shapeLayer(
        { kind: 'rounded-rectangle', width: 120, height: 120, cornerRadius: 24 },
        { fill: { kind: 'none' }, stroke: { color: '#102030', width: 10, alignment: 'center' } }
      )
    ]);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke-width="10"');
  });
});

describe('line thickness', () => {
  it('vive no corpo: alturas distintas, markups distintos, e o markup carrega a espessura', () => {
    const fina = render([shapeLayer({ kind: 'line', width: 200, height: 8 })]);
    const grossa = render([shapeLayer({ kind: 'line', width: 200, height: 24 })]);
    expect(fina).toContain('height="8"');
    expect(grossa).toContain('height="24"');
    expect(fina).not.toEqual(grossa);
  });

  it('stroke.width sozinho não move a linha: o campo é fantasma, documentado', () => {
    const cap = { color: '#102030', alignment: 'center', cap: 'round' } as const;
    const estreito = render([
      shapeLayer({ kind: 'line', width: 200, height: 32 }, { stroke: { ...cap, width: 8 } })
    ]);
    const largo = render([
      shapeLayer({ kind: 'line', width: 200, height: 32 }, { stroke: { ...cap, width: 24 } })
    ]);
    // W8 vs W24 com o mesmo H: o mesmo markup — é por isso que o slider
    // escreve a altura, e não este campo.
    expect(estreito).toEqual(largo);
    expect(estreito).not.toContain('stroke-width');
  });
});

describe('line caps', () => {
  it('defaults to the round capsule it always was', () => {
    const svg = render([shapeLayer({ kind: 'line', width: 200, height: 40 })]);
    expect(svg).toContain('rx="20"');
  });

  it('flat and square ends follow the cap on the stroke', () => {
    const butt = render([
      shapeLayer(
        { kind: 'line', width: 200, height: 40 },
        { stroke: { color: '#102030', width: 40, alignment: 'center', cap: 'butt' } }
      )
    ]);
    expect(butt).toMatch(/<rect[^>]*width="200"[^>]*height="40"[^>]*\/>/);
    expect(butt).not.toContain('rx=');

    const square = render([
      shapeLayer(
        { kind: 'line', width: 200, height: 40 },
        { stroke: { color: '#102030', width: 40, alignment: 'center', cap: 'square' } }
      )
    ]);
    expect(square).toContain('width="240"');
    expect(square).not.toContain('rx=');
  });
});

describe('effect filters', () => {
  it('emits feDropShadow for a drop shadow, and nothing without effects', () => {
    const plain = render([shapeLayer({ kind: 'rectangle', width: 80, height: 80, cornerRadius: 0 })]);
    expect(plain).not.toContain('<filter');

    const shadow = render([
      shapeLayer(
        { kind: 'rectangle', width: 80, height: 80, cornerRadius: 0 },
        { effects: [{ kind: 'drop-shadow', enabled: true, params: { x: 0, y: 10, blur: 20, color: '#000000', opacity: 0.4 } }] }
      )
    ]);
    expect(shadow).toContain('feDropShadow');
    expect(shadow).toContain('flood-opacity="0.4"');
    expect(shadow).toContain('filter="url(#');
  });

  it('composes an inner shadow and a blur', () => {
    const inner = render([
      shapeLayer(
        { kind: 'circle', width: 80, height: 80 },
        { effects: [{ kind: 'inner-shadow', enabled: true, params: { x: 0, y: 4, blur: 10, color: '#000000', opacity: 0.5 } }] }
      )
    ]);
    expect(inner).toContain('feComposite');
    expect(inner).toContain('feFlood');

    const blur = render([
      shapeLayer(
        { kind: 'circle', width: 80, height: 80 },
        { effects: [{ kind: 'surface-blur', enabled: true, params: { radius: 12 } }] }
      )
    ]);
    expect(blur).toContain('feGaussianBlur');
    expect(blur).toContain('stdDeviation="6"');
  });

  it('ignores disabled effects', () => {
    const svg = render([
      shapeLayer(
        { kind: 'rectangle', width: 80, height: 80, cornerRadius: 0 },
        { effects: [{ kind: 'drop-shadow', enabled: false, params: { x: 0, y: 4 } }] }
      )
    ]);
    expect(svg).not.toContain('feDropShadow');
  });
});
