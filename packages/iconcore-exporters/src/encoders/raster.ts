import type { CanvasMaskShape, ExportArtifactSpec, IconCoreProject, IconVariant } from '@iconcore/shared';
import { isContainerFormat, resolveSize } from '@iconcore/shared';
import type { RenderBackground, RenderBackend, RenderOptions } from '@iconcore/renderer';
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

  // Transparent unless the artifact *asks* for opaque (a PWA maskable tile) or
  // the format cannot carry alpha at all. See `backgroundModeFor`.
  const options: RenderOptions = {
    format: artifact.format,
    quality: artifact.quality,
    background: backgroundModeFor(artifact),
    mask: maskModeFor(artifact, project)
  };
  const blob = await renderProject(project, variant, target, backend, options);

  return { blob, warnings };
};

/**
 * Whether an artifact exports with the canvas background painted.
 *
 * The factory seeds every variant with an **opaque** colour (`light` #f8fafc,
 * `dark` #111827, `mono` #ffffff) so the editor has something to look at. That
 * is a design-time convenience, and letting it into the file meant every
 * exported PNG arrived as an opaque square — wrong on a light tab, invisible on
 * a dark one. So the export asks for alpha by default.
 *
 * Two cases still paint, both already expressible in the model:
 *
 * - `artifact.background === 'opaque'` — the artifact *requires* an opaque
 *   background. That is what `pwa-maskable-512` is, and the manifest marks it
 *   `purpose: 'maskable'`; without a background a maskable icon gets cropped.
 * - **JPEG has no alpha channel.** Asking for transparency there would flatten
 *   to black, which is worse than the seeded colour. `artifactNatureWarnings`
 *   already tells the user about the flattening.
 */
export const backgroundModeFor = (
  artifact: Pick<ExportArtifactSpec, 'format' | 'background'>
): RenderBackground => {
  if (artifact.format === 'jpeg') return 'canvas';
  if (artifact.background === 'opaque') return 'canvas';
  return 'transparent';
};

/**
 * The outline an exported artifact is clipped to, or `'none'` for full bleed.
 *
 * The canvas frame is the design: whatever shape and radius it carries is what
 * the file shows, so the export reads it rather than guessing per preset. What
 * it does **not** do is invent a shape — a project that declares none stays
 * full bleed, exactly as before.
 *
 * Two artifacts opt out, and both for a reason the platform states in its own
 * spec rather than taste:
 *
 * - **A container (`.ico`, `.icns`).** Windows and macOS read a single file and
 *   pick the size they want. A rounded `.ico` is not a thing — the mask is
 *   applied to the bitmap at display time, so a clipped one loses a ring of
 *   pixels that the OS would have clipped identically.
 * - **`background: 'opaque'`.** That flag means the artifact requires an opaque
 *   background, which in practice is a PWA *maskable* icon. Those are cropped by
 *   the launcher to whatever shape it likes, inside the safe zone, so a rounded
 *   export would be cropped twice.
 */
export const maskModeFor = (
  artifact: Pick<ExportArtifactSpec, 'format' | 'background'>,
  project: IconCoreProject
): CanvasMaskShape | 'none' => {
  if (isContainerFormat(artifact.format)) return 'none';
  if (artifact.background === 'opaque') return 'none';
  // Nothing declared means nothing assumed: the project renders as it always did.
  if (project.canvas.maskShape === undefined && project.canvas.maskRadius === undefined) return 'none';
  return project.canvas.maskShape ?? 'rounded-rectangle';
};