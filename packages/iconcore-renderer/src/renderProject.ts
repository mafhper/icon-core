import type { Dimensions, Fill, IconCoreProject, IconVariant } from '@iconcore/shared';
import { resolveSize } from '@iconcore/shared';
import type { RenderBackend, RenderOptions } from './types';
import { composeLayers } from './composeLayers';

/** Resolve the effective image background for a variant (variant override wins). */
export const resolveCanvasBackground = (project: IconCoreProject, variant: IconVariant): Fill => {
  const overridden = project.variants[variant]?.canvas?.background;
  if (overridden) return overridden;
  return project.canvas.background;
};

/**
 * Compose a project variant at `target` and encode it.
 *
 * `target` is the resolved pair (see `resolveSize` in `@iconcore/shared`). A
 * square target is the only shape reachable before non-square existed, and it
 * behaves exactly as the previous scalar parameter did.
 */
export const renderProject = async (
  project: IconCoreProject,
  variant: IconVariant,
  target: Dimensions,
  backend: RenderBackend,
  options: RenderOptions = {}
): Promise<Blob> => {
  const original = resolveSize(project.canvas);
  const background = resolveCanvasBackground(project, variant);

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
    original,
    background,
    variant,
    undefined,
    backend
  );

  const format = options.format ?? 'png';
  const { quality } = options;

  if (target.width === original.width && target.height === original.height) {
    if (format === 'png') return composed;
    return backend.resize(composed, original.width, original.height, format, quality);
  }

  return backend.resize(composed, target.width, target.height, format, quality);
};
