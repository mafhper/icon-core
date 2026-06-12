import type { IconCoreProject, IconTarget, IconVariant } from '@iconcore/shared';
import { exportTarget, generateReport } from '@iconcore/exporters';
import { createNodeBackend } from '@iconcore/renderer';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const parseArgs = (args: string[]): { projectPath: string; target: string; variant: string; out: string } => {
  const projectPath = args.find(a => !a.startsWith('--'));
  const target = args.find(a => a.startsWith('--target='))?.split('=')[1] ?? 'web-favicon';
  const variant = args.find(a => a.startsWith('--variant='))?.split('=')[1] ?? 'default';
  const out = args.find(a => a.startsWith('--out='))?.split('=')[1] ?? './dist';

  if (!projectPath) {
    throw new Error('Project path is required. Usage: iconcore build <project> --target=<target> --out=<dir>');
  }

  return { projectPath, target, variant, out };
};

export const buildCommand = async (args: string[]): Promise<void> => {
  const { projectPath, target, variant, out } = parseArgs(args);

  console.log(`Loading project: ${projectPath}`);
  const content = readFileSync(projectPath, 'utf-8');
  const project: IconCoreProject = JSON.parse(content);

  if (project.schemaVersion !== 2) {
    throw new Error(`Unsupported schema version: ${project.schemaVersion}. Expected 2.`);
  }

  console.log(`Building target: ${target} (variant: ${variant})`);
  console.log(`Output directory: ${out}`);

  const backend = createNodeBackend();

  try {
    const result = await exportTarget(project, target as IconTarget, variant as IconVariant, backend);

    mkdirSync(out, { recursive: true });

    for (const file of result.files) {
      const filePath = join(out, file.path);
      mkdirSync(dirname(filePath), { recursive: true });
      const buffer = Buffer.from(await file.blob.arrayBuffer());
      writeFileSync(filePath, buffer);
      console.log(`  ✓ ${file.path} (${file.size} bytes)`);
    }

    if (result.manifest) {
      const manifestPath = join(out, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));
      console.log(`  ✓ manifest.json`);
    }

    const report = generateReport(result, project, variant as IconVariant);
    const reportPath = join(out, 'iconcore-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  ✓ iconcore-report.json (score: ${report.score}/100)`);

    if (result.warnings.length > 0) {
      console.log(`\nWarnings:`);
      for (const w of result.warnings) {
        console.log(`  ⚠ ${w}`);
      }
    }

    console.log(`\nBuild complete: ${result.files.length} files generated.`);
  } finally {
    backend.destroy();
  }
};