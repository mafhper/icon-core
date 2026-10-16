import { useEffect, useRef, useState } from 'react';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { resolveSize } from '@iconcore/shared';
import { createCanvasBackend, renderProject } from '@iconcore/renderer';

/**
 * Live variant thumbnail (Fase 3): renders the project through the same
 * Canvas2D pipeline the export uses, keyed by project + variant, and hands
 * back an object URL. The previous URL is revoked before the next one lands
 * (revoking in the same tick would cancel nothing here — unlike the project
 * *download*, an `<img>` just shows the old pixels until the new URL arrives —
 * but holding every render would leak a blob per keystroke).
 */
export const useStudioPreview = (
  project: IconCoreProject | null,
  variant: IconVariant
): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project || project.layers.length === 0) {
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
        console.error('Studio tile render failed:', err);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      backend.destroy();
    };
  }, [project, variant]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  return url;
};
