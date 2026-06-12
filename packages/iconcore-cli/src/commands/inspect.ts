import type { IconCoreProject } from '@iconcore/shared';
import { readFileSync } from 'fs';

export const inspectCommand = async (args: string[]): Promise<void> => {
  const projectPath = args.find(a => !a.startsWith('--'));

  if (!projectPath) {
    throw new Error('Project path is required. Usage: iconcore inspect <project>');
  }

  const content = readFileSync(projectPath, 'utf-8');
  const project: IconCoreProject = JSON.parse(content);

  console.log(`\n📋 Project: ${project.metadata.name}`);
  console.log(`   Short name: ${project.metadata.shortName}`);
  if (project.metadata.description) {
    console.log(`   Description: ${project.metadata.description}`);
  }
  console.log(`   Schema version: ${project.schemaVersion}`);
  console.log(`   Canvas: ${project.canvas.size}x${project.canvas.size}`);
  console.log(`   Background: ${project.canvas.background.kind}${project.canvas.background.kind === 'solid' ? ` (${project.canvas.background.color})` : ''}`);

  if (project.canvas.safeArea) {
    console.log(`   Safe area: ${project.canvas.safeArea.shape} (inset: ${(project.canvas.safeArea.inset * 100).toFixed(0)}%)`);
  }

  console.log(`\n📂 Layers (${project.layers.length}):`);
  if (project.layers.length === 0) {
    console.log(`   (none)`);
  }
  for (const layer of project.layers) {
    const status = layer.visible ? '👁' : '🚫';
    console.log(`   ${status} ${layer.name} (${layer.kind}, z:${layer.zIndex})`);
  }

  console.log(`\n🎨 Variants: ${Object.keys(project.variants).join(', ')}`);

  console.log(`\n🎯 Targets:`);
  for (const t of project.targets) {
    const status = t.enabled ? '✅' : '⬜';
    console.log(`   ${status} ${t.target}`);
  }

  console.log(`\n📦 Export profile:`);
  console.log(`   Base name: ${project.exportProfile.outputBaseName}`);
  console.log(`   Quality: ${(project.exportProfile.quality * 100).toFixed(0)}%`);
  console.log(`   Report: ${project.exportProfile.generateReport ? 'yes' : 'no'}`);
};