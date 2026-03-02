import JSZip from 'jszip';
import FileSaver from 'file-saver';
import type { IconManifest } from '@iconcore/engine';
import { exportToDesktop } from '../../lib/desktopExport';

interface ExportPayload {
  files: Array<{ path: string; blob: Blob }>;
  manifest: IconManifest;
  archiveName?: string;
  manifestPath?: string;
}

const buildExportFiles = (payload: ExportPayload) => {
  const files = [...payload.files];

  const manifestBlob = new Blob([JSON.stringify(payload.manifest, null, 2)], {
    type: 'application/json'
  });

  files.push({ path: payload.manifestPath ?? 'manifest.json', blob: manifestBlob });

  return files;
};

const sanitizeArchiveName = (value: string) =>
  value
    .trim()
    .replace(/\.zip$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'iconcore-assets';

export const exportAsZip = async (payload: ExportPayload) => {
  const zip = new JSZip();
  for (const file of buildExportFiles(payload)) {
    zip.file(file.path, file.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  FileSaver.saveAs(blob, `${sanitizeArchiveName(payload.archiveName ?? 'iconcore-assets')}.zip`);
};

export const exportToDesktopFolder = async (payload: ExportPayload): Promise<boolean> => {
  return exportToDesktop(buildExportFiles(payload));
};
