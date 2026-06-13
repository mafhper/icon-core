import type { Dispatch } from 'react';
import type { IconLayer, IconVariant } from '@iconcore/shared';
import type { ComposerAction } from '../composerReducer';

export type ScopedLayerChanges = Partial<Omit<IconLayer, 'id' | 'variantOverrides'>>;

/**
 * Route a layer edit to the right place based on the active variant.
 *
 * When a non-default variant is active, edits are stored as that variant's
 * override (UPDATE_LAYER_VARIANT) so they don't leak to default/other variants —
 * which is the whole point of creating variations. On the default variant, edits
 * go to the base layer (UPDATE_LAYER).
 */
export const scopedLayerDispatch = (
  dispatch: Dispatch<ComposerAction>,
  activeVariant: IconVariant,
  id: string,
  changes: ScopedLayerChanges,
  options: { transient?: boolean } = {}
): void => {
  if (activeVariant !== 'default') {
    dispatch({ type: 'UPDATE_LAYER_VARIANT', payload: { id, variant: activeVariant, changes, transient: options.transient } });
  } else {
    dispatch({ type: 'UPDATE_LAYER', payload: { id, changes, transient: options.transient } });
  }
};
