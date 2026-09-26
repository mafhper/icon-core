import type { ZipCompression } from '@iconcore/shared';
import JSZip from 'jszip';

/** A file ready for transport. Structurally satisfied by the pipeline's `GeneratedFile`. */
export interface PackagedFile {
  path: string;
  blob: Blob;
}

/**
 * Bundle a file list into a single ZIP blob.
 *
 * Transport only (spec §2.5): the archive is a delivery choice, never part of
 * the export plan. The same `GeneratedFile[]` that the pipeline produced can be
 * zipped here, written to a folder by the desktop shell, or downloaded one by
 * one — the plan does not change between them.
 */
export const zipFiles = async (
  files: PackagedFile[],
  options: { compression?: ZipCompression; level?: number } = {}
): Promise<Blob> => {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.blob);
  }
  return zip.generateAsync({
    type: 'blob',
    compression: options.compression === 'store' ? 'STORE' : 'DEFLATE',
    compressionOptions: { level: options.level ?? 6 }
  });
};
