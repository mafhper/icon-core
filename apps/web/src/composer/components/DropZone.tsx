import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { fileToLayerAsset, isSupportedLayerFile, sortLayerFiles } from '../utils/fileLayers';

export const DropZone = () => {
  const { dispatch } = useComposer();

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = sortLayerFiles(Array.from(e.dataTransfer.files).filter(isSupportedLayerFile));

    for (const file of files) {
      try {
        const asset = await fileToLayerAsset(file);
        dispatch({ type: 'ADD_LAYER', payload: { asset } });
      } catch (err) {
        console.error('Failed to import layer:', err);
      }
    }
  }, [dispatch]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-core-border rounded-2xl p-12 text-center hover:border-core-accent transition"
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
