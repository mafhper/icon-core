import { useEffect, useRef, useState } from 'react';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

const SIZES = [16, 32, 48, 64, 128, 256, 512];
const POPOVER_MAX = 256;

export const SizeStrip = () => {
  const { state } = useComposer();
  const [previews, setPreviews] = useState<Map<number, string>>(new Map());
  const [hovered, setHovered] = useState<number | null>(null);
  // Mirror the live object-URLs in a ref so the unmount cleanup revokes the
  // current set (the effect below can't depend on `previews` without re-running).
  const previewsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!state.project) return;

    let cancelled = false;

    const render = async () => {
      const backend = createCanvasBackend();

      try {
        const rendered = await Promise.all(
          SIZES.map(async (size) => {
            try {
              const blob = await renderProject(state.project!, state.activeVariant, size, backend);
              return [size, URL.createObjectURL(blob)] as const;
            } catch (err) {
              console.error(`Failed to render size ${size}:`, err);
              return null;
            }
          })
        );

        if (cancelled) {
          rendered.forEach((entry) => entry && URL.revokeObjectURL(entry[1]));
          return;
        }

        const newPreviews = new Map<number, string>(rendered.filter((entry): entry is readonly [number, string] => entry !== null));
        previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewsRef.current = newPreviews;
        setPreviews(newPreviews);
      } finally {
        backend.destroy();
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
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (!state.project) return null;

  return (
    <div className="ic-size-strip">
      <div className="ic-size-list">
        {SIZES.map((size) => {
          const url = previews.get(size);
          const displayPx = Math.min(size, 48);
          return (
            <div
              key={size}
              className="ic-size-cell"
              onMouseEnter={() => setHovered(size)}
              onMouseLeave={() => setHovered((current) => (current === size ? null : current))}
            >
              <div className="ic-size-thumb">
                {url ? (
                  <img src={url} alt={`${size} by ${size} preview`} style={{ width: displayPx, height: displayPx }} />
                ) : (
                  <span className="ic-size-pending">{size}</span>
                )}
              </div>
              <span className="ic-size-label">{size}px</span>
              {hovered === size && url && (
                <div className="ic-size-popover" role="tooltip">
                  <img src={url} alt={`${size} by ${size} at full size`} style={{ width: Math.min(size, POPOVER_MAX), height: Math.min(size, POPOVER_MAX) }} />
                  <span>{size}×{size}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
