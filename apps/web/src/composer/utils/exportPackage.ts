import { createCanvasBackend } from '@iconcore/renderer';
import { exportTarget, generateReport, getAllTargets } from '@iconcore/exporters';
import type {
  IconCoreProject,
  IconTarget,
  IconVariant,
  OutputFormat,
  ExportStructure,
  ZipCompression
} from '@iconcore/shared';
import JSZip from 'jszip';
import { generatePreviewHtml } from './exportPreview';

export const EXPORT_TARGETS = getAllTargets();
export const EXPORT_VARIANTS: IconVariant[] = ['default', 'light', 'dark', 'mono'];

export type ExportTargetDef = (typeof EXPORT_TARGETS)[number];

/** Distinct render sizes a target produces, ascending. */
export const getTargetSizes = (target: ExportTargetDef): number[] =>
  [...new Set(target.tasks.map((task) => task.width))].sort((a, b) => a - b);

/** Conventional manifest filename per target. */
export const getManifestFileName = (target: IconTarget): string => {
  if (target === 'web-favicon') return 'site.webmanifest';
  if (target === 'pwa') return 'manifest.webmanifest';
  return 'manifest.json';
};

/** Render-task count for the given target/variant selection (drives progress). */
export const countExportTasks = (targets: IconTarget[], variants: IconVariant[]): number =>
  EXPORT_TARGETS.filter((t) => targets.includes(t.id)).reduce((sum, t) => sum + t.tasks.length, 0) * variants.length;

/** Total file count including manifests and per-target reports. */
export const countExportFiles = (targets: IconTarget[], variants: IconVariant[]): number =>
  EXPORT_TARGETS.filter((t) => targets.includes(t.id))
    .reduce((sum, t) => sum + t.tasks.length + 1 + (t.manifest ? 1 : 0), 0) * variants.length;

export const generateReadme = (projectName: string, selected: Set<IconTarget>): string => {
  const selectedTargets = EXPORT_TARGETS.filter((t) => selected.has(t.id));
  return `# ${projectName} - Icon Pack

Generated with Icon Core Export Utilities

## Contents

${selectedTargets.map((t) => `- **${t.name}** (${getTargetSizes(t).map((s) => `${s}x${s}`).join(', ')})`).join('\n')}

## Usage

### Web
Add the favicon and PWA icons to your site's <head>:
\`\`\`html
<link rel="icon" type="image/png" sizes="32x32" href="/web-favicon/icon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/web-favicon/icon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/web-favicon/icon-180x180.png">
<link rel="manifest" href="/manifest.json">
\`\`\`

### PWA
Reference the icons in your \`manifest.json\`:
\`\`\`json
{
  "name": "${projectName}",
  "icons": [
    { "src": "/pwa/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
\`\`\`

### Tauri
Place the icons in your \`src-tauri/icons/\` directory and reference them in \`tauri.conf.json\`.

### Electron
Place the icons in your project's build resources directory.

## License
Generated assets are yours to use. Icon Core itself is free and open-source.
`;
};

const FORMAT_EXT: Record<OutputFormat, string> = { png: 'png', webp: 'webp', jpeg: 'jpg' };
const FORMAT_MIME: Record<OutputFormat, string> = { png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg' };

export interface PackagedFile {
  path: string;
  blob: Blob;
}

export interface ExportProgressInfo {
  completed: number;
  total: number;
  label: string;
}

export interface BuildIconPackageOptions {
  format?: OutputFormat;
  /** 0..1, applied to lossy formats (webp/jpeg). */
  quality?: number;
  structure?: ExportStructure;
  includeReport?: boolean;
  includePreview?: boolean;
  onProgress?: (info: ExportProgressInfo) => void;
}

export interface IconPackageResult {
  files: PackagedFile[];
  warnings: string[];
}

const jsonBlob = (value: unknown): Blob =>
  new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });

const textBlob = (value: string, type = 'text/plain'): Blob => new Blob([value], { type });

const reExtension = (path: string, ext: string): string =>
  ext === 'png' ? path : path.replace(/\.png$/i, `.${ext}`);

/** Re-point manifest icon paths/types when exporting to a non-PNG format. */
const retargetManifest = (manifest: object, ext: string, mime: string): object => {
  if (ext === 'png') return manifest;
  const json = JSON.stringify(manifest).split('.png').join(`.${ext}`).split('image/png').join(mime);
  return JSON.parse(json) as object;
};

/** Resolve a file's path within the chosen folder structure. */
const entryPath = (
  structure: ExportStructure,
  targetCount: number,
  variantCount: number,
  targetId: IconTarget,
  variant: IconVariant,
  filename: string
): string => {
  if (structure === 'nested') return `${targetId}/${variant}/${filename}`;
  const parts: string[] = [];
  if (targetCount > 1) parts.push(targetId);
  if (variantCount > 1) parts.push(variant);
  return `${parts.length ? `${parts.join('-')}-` : ''}${filename}`;
};

/**
 * Render the selected targets/variants and assemble the list of output files
 * (icons, manifests, reports, README, and an optional preview contact sheet).
 * Packaging into a ZIP is a separate concern — see {@link zipFiles} — so the
 * same file list can be written to a folder on desktop or downloaded as a ZIP.
 */
export const buildIconPackage = async (
  project: IconCoreProject,
  targets: IconTarget[],
  variants: IconVariant[],
  options: BuildIconPackageOptions = {}
): Promise<IconPackageResult> => {
  const definitions = EXPORT_TARGETS.filter((t) => targets.includes(t.id));
  const total = countExportTasks(targets, variants);
  const format = options.format ?? 'png';
  const ext = FORMAT_EXT[format];
  const mime = FORMAT_MIME[format];
  const structure = options.structure ?? 'nested';
  const includeReport = options.includeReport ?? true;
  const includePreview = options.includePreview ?? true;
  const renderOptions = { format, quality: options.quality };

  const backend = createCanvasBackend();
  const files: PackagedFile[] = [];
  const warnings: string[] = [];
  let completed = 0;

  try {
    for (const variant of variants) {
      for (const target of definitions) {
        options.onProgress?.({ completed, total, label: `${target.name} / ${variant}` });

        const result = await exportTarget(project, target.id, variant, backend, renderOptions);

        for (const file of result.files) {
          files.push({
            path: entryPath(structure, targets.length, variants.length, target.id, variant, reExtension(file.path, ext)),
            blob: file.blob
          });
        }
        if (result.manifest) {
          files.push({
            path: entryPath(structure, targets.length, variants.length, target.id, variant, getManifestFileName(target.id)),
            blob: jsonBlob(retargetManifest(result.manifest, ext, mime))
          });
        }
        if (includeReport) {
          files.push({
            path: entryPath(structure, targets.length, variants.length, target.id, variant, 'iconcore-report.json'),
            blob: jsonBlob(generateReport(result, project, variant))
          });
        }
        warnings.push(...result.warnings.map((warning) => `${target.name} (${variant}): ${warning}`));

        completed += target.tasks.length;
      }
    }
  } finally {
    backend.destroy();
  }

  files.push({ path: 'README.md', blob: textBlob(generateReadme(project.metadata.name, new Set(targets)), 'text/markdown') });
  if (warnings.length > 0) {
    files.push({ path: 'WARNINGS.txt', blob: textBlob(warnings.join('\n')) });
  }
  if (includePreview) {
    const imagePaths = files.filter((f) => /\.(png|webp|jpg)$/i.test(f.path)).map((f) => f.path);
    files.push({ path: 'preview.html', blob: textBlob(generatePreviewHtml(project, imagePaths), 'text/html') });
  }

  return { files, warnings };
};

/** Bundle a built file list into a single ZIP blob with the chosen compression. */
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
