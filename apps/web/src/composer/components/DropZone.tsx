import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useComposer } from '../ComposerContext';

export const DropZone = () => {
  const { dispatch } = useComposer();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach((file) => {
      dispatch({ type: 'ADD_LAYER', payload: { file } });
    });
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