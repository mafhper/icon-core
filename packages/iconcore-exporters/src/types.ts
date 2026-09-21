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
  /**
   * Target capability: `true` accepts an alpha channel; `false` requires an
   * opaque background (e.g. PWA maskable). The project's transparency comes
   * solely from `canvas.background` — this flag never defines the document.
   */
  transparent: boolean;
}

export interface TargetDefinition {
  id: IconTarget;
  name: string;
  tasks: RasterTask[];
  manifest?: (project: IconCoreProject) => object;
}
