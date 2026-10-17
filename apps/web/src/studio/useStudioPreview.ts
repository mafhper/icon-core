import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { useRenderedProject } from '../composer/hooks/useRenderedProject';

/**
 * Live variant thumbnail: the canvas stage strip, the Inspector grid and the
 * export dialog preview share this hook — which is the same subscription the
 * canvas itself uses — so a geometry edit the logo adopts is adopted by all
 * four tiles and the grid by construction, never by a second implementation
 * that could lag behind.
 */
export const useStudioPreview = (
  project: IconCoreProject | null,
  variant: IconVariant
): string | null => useRenderedProject(project, variant);
