import type { ExportContext, ExportPlan, IconVariant } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';
import { encodeArtifact } from '../encoders';
import { planArtifacts } from './plan';
import { validatePlan } from './validate';
import { generateAttachment, generateWarningsFile } from './attachments';
import type { GeneratedFile, PlanExecutionOptions, PlanExecutionResult, PlannedArtifact } from './types';

/** Exception thrown when a plan fails structural validation. */
export class PlanValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Export plan is not ready:\n- ${problems.join('\n- ')}`);
    this.name = 'PlanValidationError';
    this.problems = problems;
  }
}

/** Blob helper used by attachment generators. */
const blobFor = (content: string, mime: string): Blob => new Blob([content], { type: mime });

/**
 * EX4 pipeline — execute an `ExportPlan` without any UI (spec §5, §6, ADR-014
 * §2.9). Flow:
 *
 * 1. validate  → `planProblems` + nature warnings (Ready · N warnings);
 * 2. plan      → `PlannedArtifact[]` (enabled artifacts, resolved paths);
 * 3. execute   → `encodeArtifact` per artifact (raster/vector/container);
 * 4. attach    → manifest/browserconfig/report/preview/readme via generators.
 *
 * The `backend` is owned by the caller (web/CLI create and destroy it); the
 * pipeline borrows it. Attachments are generated *after* artifacts so the
 * report/readme can reference real produced files.
 */
export const executePlan = async (
  plan: ExportPlan,
  context: ExportContext,
  backend: RenderBackend,
  options: PlanExecutionOptions = {}
): Promise<PlanExecutionResult> => {
  const variants = options.variants ?? ['default'];

  // 1. Validate (throws on structural problems; warnings are collected).
  const validation = validatePlan(plan, context);
  if (!validation.ready) {
    throw new PlanValidationError(validation.problems);
  }

  // 2. Plan — resolve paths/variants for every enabled artifact.
  const planned = planArtifacts(plan, context, { variants });
  const onProgress = options.onProgress;
  onProgress?.({ phase: 'planning', completed: 0, total: planned.length, done: false });

  // 3. Execute — one encode call per artifact.
  const files: GeneratedFile[] = [];
  const warnings = [...validation.warnings];
  let completed = 0;
  for (const item of planned) {
    onProgress?.({ phase: 'encoding', completed, total: planned.length, currentPath: item.path, done: false });
    const { blob, warnings: encodeWarnings } = await encodeArtifact(
      item.artifact,
      context.project,
      item.variant,
      backend,
      { svg: options.svg }
    );
    files.push({
      path: item.path,
      blob,
      size: blob.size,
      mime: item.mime,
      kind: 'artifact',
      artifactId: item.artifact.id
    });
    for (const warning of encodeWarnings) {
      warnings.push(`"${item.path}": ${warning}`);
    }
    completed += 1;
    onProgress?.({ phase: 'encoding', completed, total: planned.length, currentPath: item.path, done: false });
  }

  // 4. Attachments declared by the plan (mirrors web buildIconPackage).
  if (options.includeAttachments !== false) {
    onProgress?.({ phase: 'attaching', completed: planned.length, total: planned.length, done: false });
    for (const attachment of plan.attachments) {
      const output = generateAttachment(attachment.generator, {
        context,
        plan,
        planned,
        files,
        variant: variants[0] ?? 'default',
        warnings
      });
      if (!output) continue;
      files.push({
        path: attachment.path,
        blob: blobFor(output.content, output.mime),
        size: output.content.length,
        mime: output.mime,
        kind: 'attachment',
        generator: attachment.generator
      });
    }

    // Parity with the web export (buildIconPackage): README, report and preview
    // are default companions. Dedupe by path for plans that already declare them.
    const existing = new Set(files.map((file) => file.path));

    const readme = generateAttachment('readme', { context, plan, planned, files, variant: variants[0] ?? 'default', warnings });
    if (readme && !existing.has('README.md')) {
      files.push({ path: 'README.md', blob: blobFor(readme.content, readme.mime), size: readme.content.length, mime: readme.mime, kind: 'attachment', generator: 'readme' });
      existing.add('README.md');
    }

    const report = generateAttachment('report', { context, plan, planned, files, variant: variants[0] ?? 'default', warnings });
    if (report && !existing.has('iconcore-report.json')) {
      files.push({ path: 'iconcore-report.json', blob: blobFor(report.content, report.mime), size: report.content.length, mime: report.mime, kind: 'attachment', generator: 'report' });
      existing.add('iconcore-report.json');
    }

    const preview = generateAttachment('preview', { context, plan, planned, files, variant: variants[0] ?? 'default', warnings });
    if (preview && !existing.has('preview.html')) {
      files.push({ path: 'preview.html', blob: blobFor(preview.content, preview.mime), size: preview.content.length, mime: preview.mime, kind: 'attachment', generator: 'preview' });
      existing.add('preview.html');
    }
  }

  // 5. WARNINGS.txt — parity with web export when validation/encode warned.
  if (warnings.length > 0) {
    const content = generateWarningsFile(warnings).content;
    files.push({
      path: 'WARNINGS.txt',
      blob: blobFor(content, 'text/plain'),
      size: content.length,
      mime: 'text/plain',
      kind: 'attachment',
      generator: 'report'
    });
  }

  // Final tick. The phase stays 'encoding' when attachments were skipped — there
  // is no attaching work to report, and a UI would otherwise show a phase that
  // never happened.
  onProgress?.({
    phase: options.includeAttachments === false ? 'encoding' : 'attaching',
    completed: planned.length,
    total: planned.length,
    done: true
  });

  return { files, warnings, planned };
};

export type { GeneratedFile, PlannedArtifact };
export type { PlanExecutionOptions, PlanExecutionResult };

/** Convenience: pure plan stage without executing (for previews/validation). */
export const planForExecution = (plan: ExportPlan, context: ExportContext, variant: IconVariant): PlannedArtifact[] =>
  planArtifacts(plan, context, { variants: [variant] });