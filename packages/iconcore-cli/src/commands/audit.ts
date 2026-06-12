import type { IconCoreProject } from '@iconcore/shared';
import { auditProject } from '@iconcore/validator';
import { readFileSync } from 'fs';

export const auditCommand = async (args: string[]): Promise<void> => {
  const projectPath = args.find(a => !a.startsWith('--'));

  if (!projectPath) {
    throw new Error('Project path is required. Usage: iconcore audit <project>');
  }

  console.log(`Auditing project: ${projectPath}`);
  const content = readFileSync(projectPath, 'utf-8');
  const project: IconCoreProject = JSON.parse(content);

  if (project.schemaVersion !== 2) {
    throw new Error(`Unsupported schema version: ${project.schemaVersion}. Expected 2.`);
  }

  const result = auditProject(project);

  console.log(`\nProject: ${project.metadata.name}`);
  console.log(`Score: ${result.score}/100`);
  console.log(`Valid: ${result.valid ? '✅ Yes' : '❌ No'}\n`);

  if (result.issues.length === 0) {
    console.log('✅ No issues found.');
    process.exit(0);
  }

  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ❌ [${e.code}] ${e.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  ⚠️  [${w.code}] ${w.message}`);
    }
  }

  if (infos.length > 0) {
    console.log(`\nℹ️  Info (${infos.length}):`);
    for (const i of infos) {
      console.log(`  ℹ️  [${i.code}] ${i.message}`);
    }
  }

  if (errors.length > 0) {
    process.exit(2);
  } else if (warnings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
};