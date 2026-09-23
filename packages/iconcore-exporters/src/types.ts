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

/**
 * @deprecated superseded by `ExportPlan`/`ExportArtifact` + the encoders
 * (EX3–EX7). Kept only for the legacy `exportTarget` path used by the web app
 * until EX5 rewires it to the plan.
 */
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

/**
 * @deprecated superseded by `ExportPreset` + `buildPlan`/`planFromTarget`
 * (EX3). The corrected artifact sets live in `src/presets`.
 */
export interface TargetDefinition {
  id: IconTarget;
  name: string;
  tasks: RasterTask[];
  manifest?: (project: IconCoreProject) => object;
}
