import { useEffect, useRef, useState } from 'react';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { resolveSize } from '@iconcore/shared';
import { createCanvasBackend, renderProject } from '@iconcore/renderer';

/**
 * The single live-render subscription for the project pipeline.
 *
 * The canvas (`PreviewCanvas`) and every variant thumbnail (canvas strip,
 * Inspector grid, export dialog preview) render through this hook — the same
 * project object, the same Canvas2D pipeline the export uses — so the surfaces
 * can only disagree by a renderer defect, never by a stale subscription. A
 * second copy of this RAF/blob logic lived in the studio tiles; any future
 * divergence there (deps, cleanup, guards) would read as "tiles go obsolete
 * while the canvas updates", which is exactly the failure this unification
 * removes.
 *
 * Renders RAF-coalesced (one undo per drag stays one render per frame) and
 * hands back an object URL. The previous URL is revoked before the next one
 * lands (revoking in the same tick would cancel nothing here — unlike the
 * project *download*, an `<img>` just shows the old pixels until the new URL
 * arrives — but holding every render would leak a blob per keystroke).
 * `enabled` lets callers skip a render (the canvas compare ghost).
 */
export const useRenderedProject = (
  project: IconCoreProject | null,
  variant: IconVariant,
  enabled = true
): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project || !enabled || project.layers.length === 0) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    const backend = createCanvasBackend();
    const raf = requestAnimationFrame(async () => {
      try {
        const blob = await renderProject(project, variant, resolveSize(project.canvas), backend);
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
      } catch (err) {
        console.error('Live preview render failed:', err);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      backend.destroy();
    };
  }, [project, variant, enabled]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  return url;
};
