import type { IconLayer } from '@iconcore/shared';

/** Canvas-unit offset a duplicate sits at, down and to the right of its source. */
export const DUPLICATE_OFFSET = 24;

/**
 * IC77 duplicate (Passo 7): a copy of `layer` with a fresh id, a `<name> copy`
 * label and a small diagonal offset; the rest is shared by reference because
 * every edit in this document is immutable (a `patch` replaces the object it
 * touches, never mutates it).
 *
 * The `zIndex` is a placeholder — `insertLayer` renumbers the ladder, so
 * position, not this field, decides where the copy lands.
 */
export const duplicateLayer = (layer: IconLayer): IconLayer => ({
  ...layer,
  id: crypto.randomUUID(),
  name: `${layer.name} copy`,
  transform: {
    ...layer.transform,
    x: layer.transform.x + DUPLICATE_OFFSET,
    y: layer.transform.y + DUPLICATE_OFFSET
  }
});
