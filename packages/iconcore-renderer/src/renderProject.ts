import type { Dimensions, Fill, IconCoreProject, IconVariant } from '@iconcore/shared';
import { resolveSize } from '@iconcore/shared';
import type { RenderBackend, RenderBackground, RenderOptions } from './types';
import { composeLayers } from './composeLayers';

/** Resolve the effective image background for a variant (variant override wins). */
export const resolveCanvasBackground = (project: IconCoreProject, variant: IconVariant): Fill => {
  const overridden = project.variants[variant]?.canvas?.background;
  if (overridden) return overridden;
  return project.canvas.background;
};

/**
 * The background a render should paint.
 *
 * `transparent` wins over the project's own background: the caller has said it
 * wants an alpha channel, and an editor choice about what the canvas looks like
 * is not an instruction about what the file must contain.
 */
export const resolveRenderBackground = (
  project: IconCoreProject,
  variant: IconVariant,
  mode: RenderBackground = 'canvas'
): Fill => {
  if (mode === 'transparent') return { kind: 'none' };
  return resolveCanvasBackground(project, variant);
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
  const background = resolveRenderBackground(project, variant, options.background);

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
    backend,
    // Absent by default, so calling code that never asked for a mask keeps the
    // full-bleed output it has always produced. The export path passes the
    // canvas shape explicitly, which is what makes the file mirror the editor.
    options.mask === 'none' ? undefined : options.mask,
    project.canvas
  );

  const format = options.format ?? 'png';
  const { quality } = options;

  if (target.width === original.width && target.height === original.height) {
    if (format === 'png') return composed;
    return backend.resize(composed, original.width, original.height, format, quality);
  }

  return backend.resize(composed, target.width, target.height, format, quality);
};
