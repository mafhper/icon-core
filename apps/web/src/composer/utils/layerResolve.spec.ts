import { describe, expect, it } from 'vitest';
import type { IconLayer } from '@iconcore/shared';
import { resolveLayerVariant } from './layerResolve';

const baseLayer: IconLayer = {
  id: 'layer-1',
  name: 'Base',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'circle', width: 100, height: 100 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#ffffff' }
};

describe('resolveLayerVariant', () => {
  it('returns the base layer untouched when no override exists', () => {
    expect(resolveLayerVariant(baseLayer, 'dark')).toBe(baseLayer);
  });

  it('shallow-merges transform overrides onto the base transform', () => {
    const layer: IconLayer = {
      ...baseLayer,
      variantOverrides: { dark: { transform: { x: 12 } as IconLayer['transform'], opacity: 0.5 } }
    };
    const resolved = resolveLayerVariant(layer, 'dark');
    expect(resolved.transform).toEqual({ x: 12, y: 0, scale: 1, rotation: 0 });
    expect(resolved.opacity).toBe(0.5);
    // base layer remains unmutated
    expect(baseLayer.transform.x).toBe(0);
  });

  it('replaces effects wholesale and merges source partials', () => {
    const layer: IconLayer = {
      ...baseLayer,
      effects: [{ kind: 'depth-shadow', enabled: true, params: {} }],
      variantOverrides: {
        light: {
          source: { mimeType: 'image/png' } as IconLayer['source'],
          effects: []
        }
      }
    };
    const resolved = resolveLayerVariant(layer, 'light');
    expect(resolved.effects).toEqual([]);
    expect(resolved.source).toEqual({ type: 'reference', path: '', shape: { kind: 'circle', width: 100, height: 100 }, mimeType: 'image/png' });
  });
});
