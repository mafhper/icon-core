import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackground } from '@iconcore/renderer';
import { useRenderedProject } from '../composer/hooks/useRenderedProject';

/**
 * Live variant thumbnail: the canvas stage strip, the Inspector grid and the
 * export dialog preview share this hook — which is the same subscription the
 * canvas itself uses — so a geometry edit the logo adopts is adopted by all
 * four tiles and the grid by construction, never by a second implementation
 * that could lag behind.
 *
 * `background` is the `renderProject` mode the tile paints. The stage and the
 * Inspector grid always show the editor picture (`'canvas'`); the export
 * dialog follows its own transparency switch, so its preview is the file the
 * switch will produce rather than the editor behind it.
 */
export const useStudioPreview = (
  project: IconCoreProject | null,
  variant: IconVariant,
  background: RenderBackground = 'canvas'
): string | null => useRenderedProject(project, variant, true, background);
