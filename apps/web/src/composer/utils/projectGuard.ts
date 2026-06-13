import type { IconCoreProject } from '@iconcore/shared';

/**
 * Lightweight runtime shape check for an opened `.iconcore.json` file.
 *
 * The validator package audits *quality* of a well-formed project; this guard
 * only confirms the parsed JSON has the structural fields the editor relies on,
 * so we can reject garbage with a friendly message instead of crashing.
 */
export const isIconCoreProject = (value: unknown): value is IconCoreProject => {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Record<string, unknown>;

  const metadata = project.metadata as Record<string, unknown> | undefined;
  const canvas = project.canvas as Record<string, unknown> | undefined;

  return (
    project.schemaVersion === 2 &&
    typeof metadata === 'object' && metadata !== null && typeof metadata.name === 'string' &&
    typeof canvas === 'object' && canvas !== null && typeof canvas.size === 'number' &&
    Array.isArray(project.layers) &&
    Array.isArray(project.targets)
  );
};

/** Parse + validate a project file's text. Returns the project or null. */
export const parseProjectFile = (text: string): IconCoreProject | null => {
  try {
    const parsed = JSON.parse(text);
    return isIconCoreProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
