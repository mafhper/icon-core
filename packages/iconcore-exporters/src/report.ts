import type { ExportResult } from './types';
import { auditProject } from '@iconcore/validator';
import type { IconCoreProject, IconTarget, IconVariant } from '@iconcore/shared';

export interface ExportReport {
  generatedAt: string;
  project: { name: string; shortName: string };
  target: IconTarget;
  variant: IconVariant;
  files: Array<{ path: string; size: number }>;
  checks: {
    allSizesPresent: boolean;
    safeAreaRespected: boolean;
    contrastPassed: boolean;
  };
  warnings: string[];
  score: number;
}

export const generateReport = (
  result: ExportResult,
  project: IconCoreProject,
  variant: IconVariant
): ExportReport => {
  const audit = auditProject(project);

  const contrastIssues = audit.issues.filter(i => i.code === 'LOW_CONTRAST');
  const safeAreaIssues = audit.issues.filter(i => i.code === 'OUTSIDE_SAFE_AREA');

  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: project.metadata.name,
      shortName: project.metadata.shortName
    },
    target: result.target,
    variant,
    files: result.files.map(f => ({ path: f.path, size: f.size })),
    checks: {
      allSizesPresent: result.files.length > 0,
      safeAreaRespected: safeAreaIssues.length === 0,
      contrastPassed: contrastIssues.length === 0
    },
    warnings: result.warnings,
    score: audit.score
  };
};