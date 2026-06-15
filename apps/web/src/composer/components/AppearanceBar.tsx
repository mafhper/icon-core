import { useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

type MaskShape = 'square' | 'rounded-rectangle' | 'circle';

const APPEARANCES: Array<{ id: IconVariant; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Mono' }
];

const PLATFORMS: Array<{ id: MaskShape; label: string; radius: string }> = [
  { id: 'square', label: 'Square', radius: '14%' },
  { id: 'rounded-rectangle', label: 'Rounded', radius: '28%' },
  { id: 'circle', label: 'Circle', radius: '50%' }
];

const SIZES = [16, 32, 48, 64, 128, 256, 512];
const THUMB_RENDER = 128;

/** Render one icon per appearance variant (shared renderer → matches export). */
const useVariantThumbs = (project: IconCoreProject | null): Map<IconVariant, string> => {
  const [urls, setUrls] = useState<Map<IconVariant, string>>(new Map());
  const ref = useRef<Map<IconVariant, string>>(new Map());

  useEffect(() => {
    if (!project || project.layers.length === 0) {
      setUrls(new Map());
      return;
    }
    let cancelled = false;
    const backend = createCanvasBackend();

    const run = async () => {
      const entries: Array<[IconVariant, string]> = [];
      for (const { id } of APPEARANCES) {
        try {
          const blob = await renderProject(project, id, THUMB_RENDER, backend);
          entries.push([id, URL.createObjectURL(blob)]);
        } catch (err) {
          console.error(`Appearance thumb ${id} failed:`, err);
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

    const timer = setTimeout(() => void run(), 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      backend.destroy();
    };
  }, [project]);

  useEffect(() => () => { ref.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  return urls;
};

/** Render the active variant at every export size — only while the popover is open. */
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

export const AppearanceBar = () => {
  const { state, dispatch } = useComposer();
  const [sizesOpen, setSizesOpen] = useState(false);

  const variantThumbs = useVariantThumbs(state.project);
  const sizeThumbs = useSizeThumbs(state.project, state.activeVariant, sizesOpen);

  if (!state.project) return null;

  const activeThumb = variantThumbs.get(state.activeVariant) ?? variantThumbs.get('default');

  return (
    <div className="ic-appearance-bar">
      <div className="ic-appearance-group">
        <span className="ic-appearance-label">Platform</span>
        <div className="ic-appearance-thumbs">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              className={`ic-appearance-thumb ${state.maskShape === platform.id ? 'is-active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: platform.id })}
              title={`${platform.label} mask`}
            >
              <span className="ic-thumb-frame" style={{ borderRadius: platform.radius }}>
                {activeThumb && <img src={activeThumb} alt="" style={{ borderRadius: platform.radius }} />}
              </span>
              <span className="ic-thumb-label">{platform.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ic-appearance-spacer" />

      <div className="ic-appearance-group">
        <span className="ic-appearance-label">Appearance</span>
        <div className="ic-appearance-thumbs">
          {APPEARANCES.map((appearance) => {
            const url = variantThumbs.get(appearance.id);
            return (
              <button
                key={appearance.id}
                type="button"
                className={`ic-appearance-thumb ${state.activeVariant === appearance.id ? 'is-active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: appearance.id })}
                title={appearance.label}
              >
                <span className="ic-thumb-frame" style={{ borderRadius: '24%' }}>
                  {url
                    ? <img src={url} alt="" style={{ borderRadius: '24%' }} />
                    : <span className="ic-thumb-pending" />}
                </span>
                <span className="ic-thumb-label">{appearance.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ic-sizes-control">
          <button
            type="button"
            className={`ic-sizes-button ${sizesOpen ? 'is-active' : ''}`}
            onClick={() => setSizesOpen((v) => !v)}
            title="Preview pixel sizes"
            aria-expanded={sizesOpen}
          >
            <LayoutGrid size={15} />
            <span>Sizes</span>
          </button>
          {sizesOpen && (
            <div className="ic-sizes-pop" role="dialog" aria-label="Pixel size previews">
              {SIZES.map((size) => {
                const url = sizeThumbs.get(size);
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
    </div>
  );
};
