import { useCallback } from 'react';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { fileToLayerAsset, isSupportedLayerFile, sortLayerFiles } from '../utils/fileLayers';

/**
 * Shared image-import pipeline used by both the empty-canvas drop zone and the
 * Layers panel upload button. Accepts files from a drop event, a file-picker
 * input, or any File array, then imports each supported file as a new layer.
 */
export const useLayerImport = () => {
  const { dispatch } = useComposer();
  const toast = useToast();

  return useCallback(async (input: FileList | File[] | null | undefined) => {
    const incoming = input ? Array.from(input) : [];
    const files = sortLayerFiles(incoming.filter(isSupportedLayerFile));

    if (incoming.length > 0 && files.length === 0) {
      toast.error('Unsupported file type. Use an SVG, PNG, JPEG or WebP.');
      return;
    }

    let failures = 0;
    for (const file of files) {
      try {
        const asset = await fileToLayerAsset(file);
        dispatch({ type: 'ADD_LAYER', payload: { asset } });
      } catch (err) {
        failures++;
        console.error('Failed to import layer:', err);
      }
    }

    if (failures > 0) {
      toast.error(`Could not import ${failures} file${failures > 1 ? 's' : ''}.`);
    }
  }, [dispatch, toast]);
};
