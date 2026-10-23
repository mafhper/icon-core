import type { IconLayer } from '@iconcore/shared';

/**
 * How the sidebar groups layers.
 *
 * **Presentation only.** `IconLayer.kind` already carries everything these
 * groups need, so grouping needs no schema, no migration and no new field — and
 * collapsing a group cannot lose an edit, because a collapsed group is a view
 * state, not a document state.
 *
 * The groups are deliberately **fixed** rather than user-defined. Making them
 * configurable turns the group into part of the layer order (can a layer be in
 * two? can a group be reordered against another?), and that is a model
 * decision, not a UI one. See the task record for why it is deferred.
 */
export interface LayerGroup {
  id: LayerGroupId;
  label: string;
  /** Short explanation shown under the heading when the group is collapsed. */
  hint: string;
  layers: IconLayer[];
}

export type LayerGroupId = 'assets' | 'background';

/**
 * Definitions with two separate orderings, because they answer different
 * questions:
 *
 * - `claimRank` — which group a layer goes to. The Background handle must be
 *   tested **before** Assets, because the handle is itself a shape and would
 *   otherwise be swallowed by the catch-all. Only the semantic `role` claims
 *   it: the paint (a gradient fill, say) never does.
 * - `displayRank` — where the group appears. Assets first, Background last:
 *   the sidebar reads front-most first, and the handle is the floor of the
 *   artwork.
 */
const GROUPS: Array<{
  id: LayerGroupId;
  label: string;
  hint: string;
  claimRank: number;
  displayRank: number;
  matches: (l: IconLayer) => boolean;
}> = [
  {
    id: 'background',
    label: 'Background layer',
    hint: 'The canvas background handle. It stays at the bottom and never renders on its own.',
    claimRank: 0,
    displayRank: 1,
    matches: (layer) => layer.role === 'background'
  },
  {
    id: 'assets',
    label: 'Assets layers',
    hint: 'Text, vector shapes, images and imported SVGs.',
    claimRank: 1,
    displayRank: 0,
    matches: () => true
  }
];

/**
 * Split the sidebar's layers into the fixed groups, dropping empties.
 *
 * `input` must already be in display order (the sidebar sorts descending by
 * zIndex, so the first entry is the front-most). Order **within** each group is
 * preserved, and a group never appears empty.
 *
 * Assets is the catch-all: whatever the background does not claim lands there,
 * so a kind the sidebar does not know about yet cannot vanish from the list.
 */
export const groupLayers = (input: IconLayer[]): LayerGroup[] => {
  const remaining = [...input];
  const found: Array<LayerGroup & { displayRank: number }> = [];

  // Claim by `claimRank`, so the Background handle is taken before the Assets
  // catch-all can swallow it.
  for (const group of [...GROUPS].sort((a, b) => a.claimRank - b.claimRank)) {
    const matched = remaining.filter(group.matches);
    if (matched.length === 0) continue;
    for (const layer of matched) remaining.splice(remaining.indexOf(layer), 1);
    found.push({
      id: group.id,
      label: group.label,
      hint: group.hint,
      displayRank: group.displayRank,
      layers: matched
    });
  }

  return found
    .sort((a, b) => a.displayRank - b.displayRank)
    .map(({ displayRank: _rank, ...group }) => group);
};
