import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useLayerImport } from '../hooks/useLayerImport';

const ACCEPT = '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp';

export const DropZone = () => {
  const importFiles = useLayerImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await importFiles(e.dataTransfer.files);
  }, [importFiles]);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await importFiles(e.target.files);
    // Allow re-selecting the same file after it has been imported.
    e.target.value = '';
  }, [importFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }, [openPicker]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add layers: drop SVG, PNG, JPEG or WebP files, or click to browse"
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the cursor actually leaves the drop zone.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
      }}
      className={`ic-drop-zone${isDragging ? ' is-dragging' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <Upload size={48} className="mx-auto mb-4 text-core-muted" />
      <p className="text-sm text-core-muted mb-2">
        Drop SVG, PNG or WebP files here
      </p>
      <p className="text-xs text-core-muted">
        or click to browse your files
      </p>
    </div>
  );
};
