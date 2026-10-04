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

  return {
    blob: artifact.safeZone === undefined ? blob : await aplicarSafeZone(blob, target, artifact.safeZone, backend),
    warnings
  };
};

/**
 * Recompoe a arte com a **safe zone** da plataforma.
 *
 * O render acima produz a arte preenchendo o canvas inteiro. Para uma camada adaptive do
 * Android isso está errado: o foreground é 108×108dp mas só os **66×66dp centrais**
 * sobrevivem à máscara do launcher, e os 18dp de cada lado são cortados — ou usados para
 * parallax. A arte precisa ser reduzida a `safeZone` do canvas e centralizada no restante.
 *
 * ## Por que um segundo passo, e não um `target` menor
 *
 * Reduzir o `target` e depois esticar daria uma arte borrada: o rasterizador ampliaria uma
 * imagem pequena. O caminho é renderizar no tamanho **final** e reduzir por composição, que
 * é o mesmo que o sistema faz ao aplicar a máscara.
 *
 * ## A sanidade
 *
 * `safeZone` fora de `(0, 1]` é rejeitado aqui, com aviso, e não lançado. Um preset com
 * valor quebrado é erro de **dados**, não de código: o export deve terminar e dizer o que
 * está errado. `safeZone <= 0` cairia em `drawImage` com tamanho zero e produziria um PNG
 * transparente sem explicação.
 */
const aplicarSafeZone = async (
  blob: Blob,
  target: { width: number; height: number },
  safeZone: number,
  backend: RenderBackend
): Promise<Blob> => {
  if (!(safeZone > 0) || safeZone > 1) {
    throw new Error(`safeZone precisa estar em (0, 1]; veio ${safeZone}.`);
  }
  if (safeZone === 1) return blob;

  const largura = Math.round(target.width * safeZone);
  const altura = Math.round(target.height * safeZone);
  const dx = Math.round((target.width - largura) / 2);
  const dy = Math.round((target.height - altura) / 2);

  const img = await backend.loadImage(blob);
  const ctx = backend.createCanvas(target.width, target.height);
  backend.drawImage(ctx, img, dx, dy, largura, altura);
  return backend.toBlob(ctx, 'png');
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