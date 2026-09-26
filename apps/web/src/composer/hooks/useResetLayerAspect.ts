import { useCallback, useState } from 'react';
import type { IconLayer } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { resetLayerAspect } from '../utils/projectFactory';

/**
 * IC3 §4.2 (option C) — the "Reset aspect ratio" action.
 *
 * Correcting a layer's proportion means rewriting `source.shape` to the asset's
 * intrinsic ratio: both the Canvas2D and the SVG backends stretch the source
 * into exactly that rectangle (`layerBaseRect`), so the shape *is* the
 * proportion. No schema change is involved, and `transform` is left alone.
 *
 * Measuring a raster payload needs `createImageBitmap`, so the work is async
 * and cannot live in the (pure) reducer — the hook resolves the new layer and
 * commits it with `UPDATE_LAYER`, which is already how the inspector writes
 * structural shape edits.
 *
 * Returns whether the action applies, so callers can disable or hide the
 * control. `null` until the layer is known.
 */
export const useResetLayerAspect = (layerId?: string) => {
  const { state, dispatch } = useComposer();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Default to the active layer (the inspector); the context menu passes its own.
  const targetId = layerId ?? state.activeLayerId;
  const baseLayer = state.project?.layers.find((layer) => layer.id === targetId);
  const applies = Boolean(
    baseLayer &&
    (baseLayer.kind === 'image' || baseLayer.kind === 'svg') &&
    baseLayer.source.type === 'inline' &&
    baseLayer.source.data &&
    baseLayer.source.shape
  );

  const reset = useCallback(async () => {
    if (!baseLayer) return;
    setBusy(true);
    try {
      const result = await resetLayerAspect(baseLayer);
      if (result.status === 'reset') {
        dispatch({ type: 'UPDATE_LAYER', payload: { id: baseLayer.id, changes: { source: result.layer.source } } });
        dispatch({ type: 'COMMIT_HISTORY' });
        toast.success(
          `Aspect reset to ${result.layer.source.shape?.width}×${result.layer.source.shape?.height} (was ${result.from.width}×${result.from.height}).`
        );
      } else if (result.status === 'unchanged') {
        toast.info('This layer already matches the asset proportions.');
      } else if (result.status === 'unmeasurable') {
        toast.error('Could not read this asset’s intrinsic size, so there is no ratio to restore.');
      }
    } finally {
      setBusy(false);
    }
  }, [baseLayer, dispatch, toast]);

  /** Whether a given layer can use the action (for per-row menus). */
  const appliesTo = useCallback(
    (layer: IconLayer) =>
      (layer.kind === 'image' || layer.kind === 'svg') &&
      layer.source.type === 'inline' &&
      Boolean(layer.source.data) &&
      Boolean(layer.source.shape),
    []
  );

  return { applies, appliesTo, busy, reset };
};
