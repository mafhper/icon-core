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

export type LayerGroupId = 'text' | 'artwork' | 'background';

/**
 * Definitions with two separate orderings, because they answer different
 * questions:
 *
 * - `claimRank` — which group a layer goes to. The Background handle must be
 *   tested **before** the artwork group, because the handle is itself a `shape`
 *   and would otherwise be swallowed there. This is the order that was wrong
 *   first time round: with a single ordering, whichever way it was sorted, one
 *   of the two groups ate the other's layer.
 * - `displayRank` — where the group appears. The sidebar shows the topmost
 *   thing first: Text above Shapes, Shapes above Background.
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
    id: 'text',
    label: 'Text',
    hint: 'Editable text layers. Double-click to rename.',
    claimRank: 0,
    displayRank: 0,
    matches: (layer) => layer.kind === 'text'
  },
  {
    id: 'background',
    label: 'Background & gradients',
    hint: 'The canvas background handle. It stays at the bottom and never renders on its own.',
    claimRank: 1,
    displayRank: 2,
    matches: (layer) => layer.role === 'background'
  },
  {
    id: 'artwork',
    label: 'Shapes & imports',
    hint: 'Vector shapes, images and imported SVGs.',
    claimRank: 2,
    displayRank: 1,
    matches: (layer) => layer.kind === 'shape' || layer.kind === 'image' || layer.kind === 'svg'
  }
];

/**
 * Split the sidebar's layers into the fixed groups, dropping empties.
 *
 * `input` must already be in display order (the sidebar sorts descending by
 * zIndex, so the first entry is the front-most). Order **within** each group is
 * preserved, and a group never appears empty.
 *
 * A layer that matches no group would be invisible, so the last group is a
 * catch-all rather than a predicate — losing a layer is worse than a slightly
 * loose label.
 */
export const groupLayers = (input: IconLayer[]): LayerGroup[] => {
  const remaining = [...input];
  const found: Array<LayerGroup & { displayRank: number }> = [];

  // Claim by `claimRank`, so the Background handle is taken before the artwork
  // group can swallow it.
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

  // Catch-all, so a kind the sidebar does not know about cannot vanish.
  if (remaining.length > 0) {
    const artwork = found.find((g) => g.id === 'artwork');
    if (artwork) artwork.layers.push(...remaining);
    else
      found.push({
        id: 'artwork',
        label: 'Shapes & imports',
        hint: 'Layers whose kind the sidebar does not group yet.',
        displayRank: 1,
        layers: remaining
      });
  }

  return found
    .sort((a, b) => a.displayRank - b.displayRank)
    .map(({ displayRank: _rank, ...group }) => group);
};