import type { IconTarget } from '@iconcore/shared';

export interface ExportFile {
  path: string;
  blob: Blob;
  size: number;
}

/** Legacy per-target result, kept so the CLI contract is unchanged. */
export interface ExportResult {
  target: IconTarget;
  files: ExportFile[];
  manifest: object | null;
  warnings: string[];
}
