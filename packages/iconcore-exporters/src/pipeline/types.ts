import type {
  ExportArtifact,
  ExportArtifactKind,
  ExportAttachmentGenerator,
  ExportFormat,
  IconVariant
} from '@iconcore/shared';

export type { ExportAttachmentGenerator };

/**
 * The artifact, bound to execution: resolved output path, resolved variant and
 * the format metadata a preview/catalog/report needs (ADR-014 §2.9). This is
 * the "what will be generated" layer, distinct from {@link GeneratedFile}.
 */
export interface PlannedArtifact {
  /** The source spec (unedited). */
  artifact: ExportArtifact;
  /** Output path with tokens applied (`{name}`, `{variant}`, `{format}`…). */
  path: string;
  /** Variant this artifact will be rendered as. */
  variant: IconVariant;
  /** Derived nature (raster/vector/container). */
  kind: ExportArtifactKind;
  format: ExportFormat;
  /** Mime type of the produced file. */
  mime: string;
  /**
   * For raster/vector: the side length in px. For containers: the largest
   * embedded entry (used by previews/catalogs — the container itself has no
   * single size).
   */
  size: number;
  /** Container physical entries (only when `format` is ico/icns). */
  entries?: number[];
}

/** Whether a produced file is a planned artifact or a plan attachment. */
export type GeneratedFileKind = 'artifact' | 'attachment';

/** A produced file with transport metadata (ADR-014 §2.9). */
export interface GeneratedFile {
  path: string;
  blob: Blob;
  /** Byte size. */
  size: number;
  mime: string;
  kind: GeneratedFileKind;
  /** Artifact id when `kind === 'artifact'`. */
  artifactId?: string;
  /** Attachment generator when `kind === 'attachment'`. */
  generator?: ExportAttachmentGenerator;
}

/** Options accepted by {@link executePlan}. */
export interface PlanExecutionOptions {
  /**
   * Variants to expand artifacts that carry no explicit `variant` (default
   * `['default']`). Artifacts with an explicit variant ignore this list.
   */
  variants?: IconVariant[];
  /** SVG encode options (embed images, max embedded bytes). */
  svg?: { embedImages?: boolean; maxEmbeddedImageBytes?: number };
  /** Generate the plan attachments declared on the plan. Default: true. */
  includeAttachments?: boolean;
}

/** Result of executing a plan (files + diagnostics). */
export interface PlanExecutionResult {
  files: GeneratedFile[];
  warnings: string[];
  /** The planned artifacts that were executed (enabled only). */
  planned: PlannedArtifact[];
}