import { describe, expect, it } from 'vitest';
import {
  EXPORT_TARGETS,
  countExportFiles,
  countExportTasks,
  generateReadme,
  getManifestFileName,
  getTargetSizes
} from './exportPackage';

describe('export packaging helpers', () => {
  it('maps targets to their conventional manifest filename', () => {
    expect(getManifestFileName('web-favicon')).toBe('site.webmanifest');
    expect(getManifestFileName('pwa')).toBe('manifest.webmanifest');
    expect(getManifestFileName('tauri')).toBe('manifest.json');
  });

  it('returns distinct ascending sizes for a target', () => {
    const target = EXPORT_TARGETS[0];
    const sizes = getTargetSizes(target);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('scales task and file counts by the number of variants', () => {
    const targets = ['web-favicon'] as const;
    const oneVariant = countExportTasks([...targets], ['default']);
    const twoVariants = countExportTasks([...targets], ['default', 'dark']);
    expect(twoVariants).toBe(oneVariant * 2);
    // file count includes the per-target report (+1) so it exceeds the task count
    expect(countExportFiles([...targets], ['default'])).toBeGreaterThan(oneVariant);
  });

  it('lists only the selected targets in the generated README', () => {
    const readme = generateReadme('My App', new Set(['web-favicon']));
    expect(readme).toContain('# My App - Icon Pack');
    const favicon = EXPORT_TARGETS.find((t) => t.id === 'web-favicon')!;
    expect(readme).toContain(favicon.name);
  });
});
