import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';
import { renderToSvgWithOptions } from '@iconcore/renderer';

export interface SvgEncodeOptions {
  /**
   * Embed raster image layers as `data:` URIs (ADR-014 §7). Default: true —
   * natural sizes come from the backend so the placement matches the Canvas2D
   * render (contain-fit inside the canvas).
   */
  embedImages?: boolean;
  /** Alert when an embedded base64 image exceeds this byte threshold. */
  maxEmbeddedImageBytes?: number;
}

export const encodeSvg = async (
  project: IconCoreProject,
  variant: IconVariant,
  backend: RenderBackend,
  options: SvgEncodeOptions = {}
): Promise<{ blob: Blob; warnings: string[] }> => {
  const imageSizes = new Map<string, { width: number; height: number }>();

  if (options.embedImages !== false) {
    for (const layer of project.layers) {
      const { data, mimeType } = layer.source;
      if (!data || !mimeType || mimeType === 'image/svg+xml') continue;
      try {
        const handle = await backend.loadImage(`data:${mimeType};base64,${data}`);
        if (handle && handle.width > 0 && handle.height > 0) {
          imageSizes.set(layer.id, { width: handle.width, height: handle.height });
        }
      } catch {
        // Unresolvable here — renderToSvgWithOptions reports the omission.
      }
    }
  }

  const { svg, warnings } = renderToSvgWithOptions(project, variant, {
    imageSizes,
    skipImages: options.embedImages === false,
    maxEmbeddedImageBytes: options.maxEmbeddedImageBytes
  });

  return { blob: new Blob([svg], { type: 'image/svg+xml' }), warnings };
};