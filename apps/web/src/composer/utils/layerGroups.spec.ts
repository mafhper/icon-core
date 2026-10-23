import { describe, expect, it } from 'vitest';
import type { IconLayer } from '@iconcore/shared';
import { groupLayers } from './layerGroups';

const layer = (over: Partial<IconLayer> & { id: string }): IconLayer => ({
  name: over.id,
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 10, height: 10 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  ...over
});

/** Sidebar order is descending zIndex — front-most first. */
const display = (...layers: IconLayer[]) => [...layers].sort((a, b) => b.zIndex - a.zIndex);

describe('groupLayers', () => {
  it('splits into Assets and Background — every kind in Assets, background last', () => {
    const groups = groupLayers(
      display(
        layer({ id: 'title', kind: 'text', zIndex: 3 }),
        layer({ id: 'logo', kind: 'svg', zIndex: 2 }),
        layer({ id: 'photo', kind: 'image', zIndex: 1 }),
        layer({ id: 'circle', kind: 'shape', zIndex: 0 }),
        layer({ id: 'bg', kind: 'shape', role: 'background', zIndex: -1 })
      )
    );

    expect(groups.map((g) => g.id)).toEqual(['assets', 'background']);
    expect(groups[0].layers.map((l) => l.id)).toEqual(['title', 'logo', 'photo', 'circle']);
    expect(groups[1].layers.map((l) => l.id)).toEqual(['bg']);
  });

  it('drops empty groups rather than showing a heading with nothing under it', () => {
    const groups = groupLayers(display(layer({ id: 'circle', kind: 'shape', zIndex: 0 })));
    expect(groups.map((g) => g.id)).toEqual(['assets']);
  });

  it('returns nothing for an empty project', () => {
    expect(groupLayers([])).toEqual([]);
  });

  it('preserves order within a group', () => {
    const groups = groupLayers(
      display(
        layer({ id: 'c', kind: 'shape', zIndex: 5 }),
        layer({ id: 'a', kind: 'shape', zIndex: 4 }),
        layer({ id: 'b', kind: 'shape', zIndex: 3 })
      )
    );
    // Display order is front-most first, so the group keeps it.
    expect(groups[0].layers.map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('never loses a layer, even one whose kind no group matches', () => {
    const odd = layer({ id: 'weird', zIndex: 2 }) as IconLayer;
    // A kind the sidebar does not know about yet: the Assets catch-all takes it.
    (odd as { kind: string }).kind = 'future-kind';

    const groups = groupLayers(display(odd, layer({ id: 'circle', zIndex: 1 })));
    expect(groups.find((g) => g.id === 'assets')?.layers.map((l) => l.id)).toEqual(['weird', 'circle']);
  });

  it('lets the role win over the kind: a text handle still goes to Background', () => {
    const groups = groupLayers(
      display(
        layer({ id: 'circle', kind: 'shape', zIndex: 1 }),
        layer({ id: 'bg-text', kind: 'text', role: 'background', zIndex: -1 })
      )
    );
    expect(groups.find((g) => g.id === 'background')?.layers.map((l) => l.id)).toEqual(['bg-text']);
    // And it is not also listed as an asset.
    expect(groups.find((g) => g.id === 'assets')?.layers.map((l) => l.id)).toEqual(['circle']);
  });

  it('keeps a gradient-filled shape in Assets: the paint never claims Background', () => {
    const groups = groupLayers(
      display(layer({ id: 'gradient', kind: 'shape', fill: { kind: 'linear-gradient' }, zIndex: 0 }))
    );
    expect(groups.map((g) => g.id)).toEqual(['assets']);
    expect(groups[0].layers.map((l) => l.id)).toEqual(['gradient']);
  });

  it('names the groups in sentence case — the sidebar uppercases them in CSS', () => {
    const groups = groupLayers(
      display(
        layer({ id: 'title', kind: 'text', zIndex: 2 }),
        layer({ id: 'circle', kind: 'shape', zIndex: 1 }),
        layer({ id: 'bg', role: 'background', zIndex: -1 })
      )
    );
    expect(groups.map((g) => g.label)).toEqual(['Assets layers', 'Background layer']);
    for (const g of groups) {
      expect(g.hint.length).toBeGreaterThan(0);
    }
  });
});
