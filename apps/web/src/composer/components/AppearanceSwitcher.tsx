import { useEffect, useRef, useState } from 'react';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

const APPEARANCES: Array<{ id: IconVariant; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Mono' }
];

const THUMB_RENDER = 32;

/**
 * Render one thumbnail per appearance variant through the SAME Canvas2D
 * pipeline used for export, so the previews match the exported asset.
 */
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

/**
 * Floating appearance switcher, docked to the bottom of the canvas stage
 * (RuneIcons-style mini toolbar). The active variant is highlighted; the
 * others are dimmed to indicate only one mode is being edited at a time.
 */
export const AppearanceSwitcher = () => {
  const { state, dispatch } = useComposer();
  const thumbs = useVariantThumbs(state.project);

  if (!state.project) return null;

  return (
    <div className="ic-floating-appearance" role="group" aria-label="Icon appearance variants">
      {APPEARANCES.map((appearance) => {
        const active = state.activeVariant === appearance.id;
        return (
          <button
            key={appearance.id}
            type="button"
            className={`ic-appearance-thumb ${active ? 'is-active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: appearance.id })}
            title={appearance.label}
            aria-label={appearance.label}
            aria-pressed={active}
          >
            <span className="ic-thumb-frame">
              {thumbs.get(appearance.id)
                ? <img src={thumbs.get(appearance.id)} alt="" />
                : <span className="ic-thumb-pending" />}
            </span>
          </button>
        );
      })}
    </div>
  );
};