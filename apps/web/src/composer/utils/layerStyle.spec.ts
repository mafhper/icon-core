import { describe, expect, it } from 'vitest';
import type { IconLayer, ShapeKind } from '@iconcore/shared';
import { borderRadiusForLayer, fillColor, fillToCss, getShadow, setShadow, shadowCssForLayer } from './layerStyle';

const shapeLayer = (kind: ShapeKind, cornerRadius?: number): IconLayer => ({
  id: 'l',
  name: 'l',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind, width: 100, height: 100, cornerRadius } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1
});

describe('fillToCss', () => {
  it('handles missing fills, solids and gradients', () => {
    expect(fillToCss(undefined)).toBe('transparent');
    expect(fillToCss({ kind: 'solid', color: '#abcdef' })).toBe('#abcdef');
    expect(fillToCss({ kind: 'linear-gradient', angle: 90, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] }))
      .toBe('linear-gradient(90deg, #000 0%, #fff 100%)');
    expect(fillToCss({ kind: 'radial-gradient', stops: [] })).toContain('radial-gradient(ellipse');
    expect(fillToCss({ kind: 'radial-gradient', stops: [], centerX: 0.25, centerY: 0.75 })).toContain('at 25% 75%');
  });
});

describe('fillColor', () => {
  it('extracts solid color and falls back for gradients', () => {
    expect(fillColor({ kind: 'solid', color: '#123456' })).toBe('#123456');
    expect(fillColor({ kind: 'linear-gradient' })).toBe('#111827');
    expect(fillColor(undefined)).toBe('#111827');
  });
});

describe('borderRadiusForLayer', () => {
  it('maps shape kinds to css radius', () => {
    expect(borderRadiusForLayer(shapeLayer('circle'))).toBe('999px');
    expect(borderRadiusForLayer(shapeLayer('squircle'))).toBe('28%');
    expect(borderRadiusForLayer(shapeLayer('rounded-rectangle', 12))).toBe('12px');
    expect(borderRadiusForLayer(shapeLayer('rectangle'))).toBe('0px');
  });
});

describe('shadow helpers', () => {
  it('returns a disabled default when no shadow effect exists', () => {
    const shadow = getShadow(shapeLayer('circle'));
    expect(shadow.enabled).toBe(false);
    expect(shadowCssForLayer(shapeLayer('circle'))).toBeUndefined();
  });

  it('upserts a depth-shadow effect and renders css when enabled', () => {
    const layer = shapeLayer('circle');
    const effects = setShadow(layer, { kind: 'depth-shadow', enabled: true, params: { x: 1, y: 2, blur: 4, color: '#000' } });
    expect(effects).toHaveLength(1);
    expect(shadowCssForLayer({ ...layer, effects })).toBe('1px 2px 4px #000');
  });
});
