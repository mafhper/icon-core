import type { IconVariant } from '@iconcore/shared';

const TILES: Array<{ id: IconVariant; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Monochrome' }
];

/** The four appearance variants the stage tiles and the inspector preview share. */
export const variantTiles = (): Array<{ id: IconVariant; label: string }> => TILES;

/** Display label for an appearance variant id. */
export const variantLabel = (variant: IconVariant): string =>
  TILES.find((tile) => tile.id === variant)?.label ?? 'Default';
