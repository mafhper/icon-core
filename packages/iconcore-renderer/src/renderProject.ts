import type { Fill, IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackend } from './types';
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
  backend: RenderBackend
): Promise<Blob> => {
  const originalSize = project.canvas.size;
  const background = resolveBackground(project, variant);

  const safeAreaParam = project.canvas.safeArea
    ? { inset: project.canvas.safeArea.inset, shape: project.canvas.safeArea.shape === 'square' ? 'rectangle' as const : project.canvas.safeArea.shape }
    : undefined;

  const composed = await composeLayers(
    project.layers,
    originalSize,
    background,
    variant,
    safeAreaParam,
    backend
  );

  if (targetSize === originalSize) {
    return composed;
  }

  return backend.resize(composed, targetSize, targetSize);
};