import type { IconTarget, IconCoreProject } from '@iconcore/shared';

export interface ExportFile {
  path: string;
  blob: Blob;
  size: number;
}

export interface ExportResult {
  target: IconTarget;
  files: ExportFile[];
  manifest: object | null;
  warnings: string[];
}

export interface RasterTask {
  path: string;
  width: number;
  height: number;
  transparent: boolean;
}

export interface TargetDefinition {
  id: IconTarget;
  name: string;
  tasks: RasterTask[];
  manifest?: (project: IconCoreProject) => object;
}
