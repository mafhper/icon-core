import { useEffect, useState } from 'react';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

const SIZES = [16, 32, 48, 64, 128, 256, 512];

export const SizeStrip = () => {
  const { state } = useComposer();
  const [previews, setPreviews] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!state.project) return;

    let cancelled = false;

    const render = async () => {
      const newPreviews = new Map<number, string>();
      const backend = createCanvasBackend();

      for (const size of SIZES) {
        if (cancelled) break;
        try {
          const blob = await renderProject(
            state.project!,
            state.activeVariant,
            size,
            backend
          );
          const url = URL.createObjectURL(blob);
          newPreviews.set(size, url);
        } catch (err) {
          console.error(`Failed to render size ${size}:`, err);
        }
      }

      backend.destroy();

      if (!cancelled) {
        setPreviews((old) => {
          old.forEach((url) => URL.revokeObjectURL(url));
          return newPreviews;
        });
      }
    };

    const timer = setTimeout(render, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.project, state.activeVariant]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (!state.project) return null;

  return (
    <div className="border-t border-core-border bg-core-surface px-4 py-3">
      <div className="flex items-center gap-4 overflow-x-auto">
        {SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className="border border-core-border rounded bg-white flex items-center justify-center"
              style={{ width: Math.min(size, 64), height: Math.min(size, 64) }}
            >
              {previews.get(size) ? (
                <img
                  src={previews.get(size)}
                  alt={`${size}x${size}`}
                  style={{ width: size, height: size }}
                  className="rounded"
                />
              ) : (
                <div className="text-[10px] text-core-muted">{size}×{size}</div>
              )}
            </div>
            <span className="text-[10px] text-core-muted">{size}px</span>
          </div>
        ))}
      </div>
    </div>
  );
};