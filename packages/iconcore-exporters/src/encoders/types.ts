import type { ExportArtifact, IconCoreProject, IconVariant } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';

export type { ExportArtifact } from '@iconcore/shared';

/** Inputs shared by every encoder (EX2 / IC15B). */
export interface EncoderInput {
  artifact: ExportArtifact;
  project: IconCoreProject;
  variant: IconVariant;
  backend: RenderBackend;
}

/** Output of an encoder: a single file plus human-readable warnings. */
export interface EncoderOutput {
  blob: Blob;
  warnings: string[];
}