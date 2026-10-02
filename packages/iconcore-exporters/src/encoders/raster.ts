import type { ExportArtifactSpec, IconCoreProject, IconVariant } from '@iconcore/shared';
import { resolveSize } from '@iconcore/shared';
import type { RenderBackend, RenderOptions } from '@iconcore/renderer';
import { renderProject, resolveCanvasBackground } from '@iconcore/renderer';

export type RasterFormat = 'png' | 'webp' | 'jpeg';

/**
 * Raster encoder — PNG/WebP/JPEG via the render backend.
 *
 * Rendering is delegated to `renderProject` (compose-lossless-then-encode once),
 * so a WebP/JPEG at a downscaled size is encoded from the native composition
 * rather than re-encoded from an intermediate lossy file.
 */
export const encodeRaster = async (
  artifact: ExportArtifactSpec & { format: RasterFormat },
  project: IconCoreProject,
  variant: IconVariant,
  backend: RenderBackend
): Promise<{ blob: Blob; warnings: string[] }> => {
  const warnings: string[] = [];

  if (
    artifact.background === 'opaque' &&
    resolveCanvasBackground(project, variant).kind === 'none'
  ) {
    warnings.push(
      `"${artifact.path}" requires an opaque background, but the project is transparent.`
    );
  }

  // `size` alone stays square (the only shape reachable before non-square); an
  // explicit `height` turns the pair non-square. Absent both, the canvas pair.
  const canvas = resolveSize(project.canvas);
  const target = resolveSize({
    size: artifact.size ?? canvas.width,
    height: artifact.height ?? (artifact.size === undefined ? canvas.height : undefined)
  });
  const options: RenderOptions = { format: artifact.format, quality: artifact.quality };
  const blob = await renderProject(project, variant, target, backend, options);

  return { blob, warnings };
};