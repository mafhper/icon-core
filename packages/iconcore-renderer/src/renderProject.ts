import type { Fill, IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackend, RenderOptions } from './types';
import { composeLayers } from './composeLayers';

const resolveBackground = (project: IconCoreProject, variant: IconVariant): Fill => {
  const overridden = project.variants[variant]?.canvas?.background;
  if (overridden) return overridden;
  return project.canvas.background;
};

export const renderProject = async (
  project: IconCoreProject,
  variant: IconVariant,
  targetSize: number,
  backend: RenderBackend,
  options: RenderOptions = {}
): Promise<Blob> => {
  const originalSize = project.canvas.size;
  const background = resolveBackground(project, variant);

  // The safe area is a GUIDE only (shown via the keyline overlay and the quality
  // audit) — it never clips or masks the exported pixels. Icons render full-bleed
  // so the OS/platform can apply its own mask at display time. Hence no safe-area
  // argument is passed to the compositor.
  //
  // Compose at native size as a lossless PNG, then encode to the requested format
  // once — avoids double lossy re-encoding when a format like webp/jpeg is
  // combined with a downscale.
  const composed = await composeLayers(
    project.layers,
    originalSize,
    background,
    variant,
    undefined,
    backend
  );

  const format = options.format ?? 'png';
  const { quality } = options;

  if (targetSize === originalSize) {
    if (format === 'png') return composed;
    return backend.resize(composed, originalSize, originalSize, format, quality);
  }

  return backend.resize(composed, targetSize, targetSize, format, quality);
};