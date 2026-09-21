import type { IconCoreProject } from '@iconcore/shared';
import { migrateToCurrent, type IconCoreProjectV2 } from '@iconcore/engine';

/**
 * Lightweight runtime shape check for an opened `.iconcore.json` file.
 *
 * The validator package audits *quality* of a well-formed project; this guard
 * only confirms the parsed JSON has the structural fields the editor relies on,
 * so we can reject garbage with a friendly message instead of crashing.
 *
 * Accepts both v2 (legacy) and v3 (canonical) — callers migrate with
 * `migrateToCurrent`.
 */
export const isIconCoreProject = (value: unknown): value is IconCoreProjectV2 | IconCoreProject => {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Record<string, unknown>;

  const metadata = project.metadata as Record<string, unknown> | undefined;
  const canvas = project.canvas as Record<string, unknown> | undefined;

  return (
    (project.schemaVersion === 2 || project.schemaVersion === 3) &&
    typeof metadata === 'object' && metadata !== null && typeof metadata.name === 'string' &&
    typeof canvas === 'object' && canvas !== null && typeof canvas.size === 'number' &&
    Array.isArray(project.layers) &&
    Array.isArray(project.targets)
  );
};

/** Parse + validate a project file's text, returning the canonical project or null. */
export const parseProjectFile = (text: string): IconCoreProject | null => {
  try {
    const parsed = JSON.parse(text);
    return isIconCoreProject(parsed) ? migrateToCurrent(parsed) : null;
  } catch {
    return null;
  }
};
