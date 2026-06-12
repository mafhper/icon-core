import type { IconTarget, IconVariant, IconCoreProject } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';
import { renderProject } from '@iconcore/renderer';
import { auditProject } from '@iconcore/validator';
import type { ExportResult, ExportFile, TargetDefinition } from './types';
import { webFavicon } from './targets/web-favicon';
import { pwa } from './targets/pwa';
import { tauri } from './targets/tauri';
import { electron } from './targets/electron';
import { desktopGeneric } from './targets/desktop-generic';
import { marketing } from './targets/marketing';

const TARGET_REGISTRY: Record<string, TargetDefinition> = {
  'web-favicon': webFavicon,
  'pwa': pwa,
  'tauri': tauri,
  'electron': electron,
  'desktop-generic': desktopGeneric,
  'marketing': marketing
};

export const getTargetDefinition = (target: IconTarget): TargetDefinition | undefined => {
  return TARGET_REGISTRY[target];
};

export const getAllTargets = (): TargetDefinition[] => {
  return Object.values(TARGET_REGISTRY);
};

export const exportTarget = async (
  project: IconCoreProject,
  target: IconTarget,
  variant: IconVariant,
  backend: RenderBackend
): Promise<ExportResult> => {
  const definition = TARGET_REGISTRY[target];
  if (!definition) {
    return {
      target,
      files: [],
      manifest: null,
      warnings: [`Unknown target: ${target}`]
    };
  }

  const files: ExportFile[] = [];
  const warnings: string[] = [];

  for (const task of definition.tasks) {
    try {
      const blob = await renderProject(project, variant, task.width, backend);
      files.push({
        path: task.path,
        blob,
        size: blob.size
      });
    } catch (err) {
      warnings.push(`Failed to render ${task.path}: ${(err as Error).message}`);
    }
  }

  const manifest = definition.manifest ? definition.manifest(project) : null;

  const audit = auditProject(project);
  for (const issue of audit.issues) {
    if (issue.severity === 'warning' || issue.severity === 'error') {
      warnings.push(issue.message);
    }
  }

  return { target, files, manifest, warnings };
};

export const exportAllTargets = async (
  project: IconCoreProject,
  variant: IconVariant,
  targets: IconTarget[],
  backend: RenderBackend
): Promise<ExportResult[]> => {
  const results: ExportResult[] = [];
  for (const target of targets) {
    const result = await exportTarget(project, target, variant, backend);
    results.push(result);
  }
  return results;
};