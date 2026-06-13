import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { fileToLayerAsset, isSupportedLayerFile, sortLayerFiles } from '../utils/fileLayers';

export const DropZone = () => {
  const { dispatch } = useComposer();
  const toast = useToast();

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    const files = sortLayerFiles(dropped.filter(isSupportedLayerFile));

    if (dropped.length > 0 && files.length === 0) {
      toast.error('Unsupported file type. Drop an SVG, PNG, JPEG or WebP.');
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="ic-drop-zone"
    >
      <Upload size={48} className="mx-auto mb-4 text-core-muted" />
      <p className="text-sm text-core-muted mb-2">
        Drop SVG, PNG or WebP files here
      </p>
      <p className="text-xs text-core-muted">
        or use the upload button in the Layers panel
      </p>
    </div>
  );
};
