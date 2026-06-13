import { createCanvasBackend } from '@iconcore/renderer';
import { exportTarget, generateReport, getAllTargets } from '@iconcore/exporters';
import type { IconCoreProject, IconTarget, IconVariant } from '@iconcore/shared';
import JSZip from 'jszip';

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

export interface ExportProgressInfo {
  completed: number;
  total: number;
  label: string;
}

export interface BuildIconPackageOptions {
  onProgress?: (info: ExportProgressInfo) => void;
  /** Called once after rendering finishes, before the ZIP is generated. */
  onArchiveStart?: () => void;
}

export interface IconPackageResult {
  blob: Blob;
  warnings: string[];
}

/**
 * Render the selected targets/variants and assemble a downloadable ZIP.
 *
 * Pure orchestration extracted from ExportView so the UI stays thin and the
 * packaging flow can be reasoned about (and partially unit-tested) on its own.
 */
export const buildIconPackage = async (
  project: IconCoreProject,
  targets: IconTarget[],
  variants: IconVariant[],
  options: BuildIconPackageOptions = {}
): Promise<IconPackageResult> => {
  const definitions = EXPORT_TARGETS.filter((t) => targets.includes(t.id));
  const total = countExportTasks(targets, variants);
  const zip = new JSZip();
  const backend = createCanvasBackend();
  const warnings: string[] = [];
  let completed = 0;

  try {
    for (const variant of variants) {
      for (const target of definitions) {
        options.onProgress?.({ completed, total, label: `${target.name} / ${variant}` });

        const result = await exportTarget(project, target.id, variant, backend);
        const folder = zip.folder(`${target.id}/${variant}`)!;

        for (const file of result.files) {
          folder.file(file.path, file.blob);
        }
        if (result.manifest) {
          folder.file(getManifestFileName(target.id), JSON.stringify(result.manifest, null, 2));
        }
        folder.file('iconcore-report.json', JSON.stringify(generateReport(result, project, variant), null, 2));
        warnings.push(...result.warnings.map((warning) => `${target.name} (${variant}): ${warning}`));

        completed += target.tasks.length;
      }
    }
  } finally {
    backend.destroy();
  }

  options.onArchiveStart?.();
  zip.file('README.md', generateReadme(project.metadata.name, new Set(targets)));
  if (warnings.length > 0) {
    zip.file('WARNINGS.txt', warnings.join('\n'));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, warnings };
};
