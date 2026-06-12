import type { IconTarget, IconVariant, IconCoreProject } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';

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