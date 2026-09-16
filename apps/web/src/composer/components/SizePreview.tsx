import { useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

const SIZES = [16, 32, 48, 64, 128, 256, 512];

/**
 * Render the active variant at every export size — only while the popover is
 * open (the preview grid is the only consumer of these renders).
 */
const useSizeThumbs = (project: IconCoreProject | null, variant: IconVariant, enabled: boolean): Map<number, string> => {
  const [urls, setUrls] = useState<Map<number, string>>(new Map());
  const ref = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!project || !enabled || project.layers.length === 0) {
      setUrls(new Map());
      return;
    }
    let cancelled = false;
    const backend = createCanvasBackend();

    const run = async () => {
      const entries: Array<[number, string]> = [];
      for (const size of SIZES) {
        try {
          const blob = await renderProject(project, variant, size, backend);
          entries.push([size, URL.createObjectURL(blob)]);
        } catch (err) {
          console.error(`Size thumb ${size} failed:`, err);
        }
      }
      if (cancelled) {
        entries.forEach(([, url]) => URL.revokeObjectURL(url));
        return;
      }
      ref.current.forEach((url) => URL.revokeObjectURL(url));
      const map = new Map(entries);
      ref.current = map;
      setUrls(map);
    };

    void run();
    return () => {
      cancelled = true;
      backend.destroy();
    };
  }, [project, variant, enabled]);

  useEffect(() => () => { ref.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  return urls;
};

/**
 * Pixel-size preview button for the app-level action bar. Icon-only so it
 * can live among the flat toolbar icons; the popover opens upward and is not
 * clipped (the canvas toolbar's overflow used to swallow it).
 */
export const SizePreview = () => {
  const { state } = useComposer();
  const [open, setOpen] = useState(false);
  const thumbs = useSizeThumbs(state.project, state.activeVariant, open);

  return (
    <div className="ic-sizes-control">
      <button
        type="button"
        className={`ic-sizes-button ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Preview pixel sizes"
        aria-label="Preview pixel sizes"
        aria-expanded={open}
      >
        <LayoutGrid size={15} />
      </button>
      {open && (
        <div className="ic-sizes-pop" role="dialog" aria-label="Pixel size previews">
          {SIZES.map((size) => {
            const url = thumbs.get(size);
            const px = Math.min(size, 64);
            return (
              <div key={size} className="ic-size-cell">
                <div className="ic-size-thumb" style={{ width: 64, height: 64 }}>
                  {url
                    ? <img src={url} alt={`${size} preview`} style={{ width: px, height: px }} />
                    : <span className="ic-size-pending">{size}</span>}
                </div>
                <span className="ic-size-label">{size}px</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};