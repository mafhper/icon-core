import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import type { IconCoreProject } from '@iconcore/shared';

const TMP_DIR = join(process.cwd(), 'tmp-cli-test');

const createTestProject = (): string => {
  mkdirSync(TMP_DIR, { recursive: true });
  const project: IconCoreProject = {
    schemaVersion: 2,
    metadata: { name: 'CLI Test', shortName: 'Test' },
    canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
    layers: [],
    variants: { default: {} },
    targets: [{ target: 'web-favicon', enabled: true }],
    exportProfile: { outputBaseName: 'cli-test', quality: 0.95, generateReport: false }
  };
  const path = join(TMP_DIR, 'test-project.iconcore.json');
  writeFileSync(path, JSON.stringify(project, null, 2));
  return path;
};

describe('CLI commands', () => {
  it('create command generates valid project file', async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const outPath = join(TMP_DIR, 'created.iconcore.json');

    const { createCommand } = await import('../src/commands/create');

    const originalLog = console.log;
    console.log = () => {};
    await createCommand([`--preset=web`, `--name=Test`, `--out=${outPath}`]);
    console.log = originalLog;

    const content = readFileSync(outPath, 'utf-8');
    const project: IconCoreProject = JSON.parse(content);

    expect(project.schemaVersion).toBe(2);
    expect(project.metadata.name).toBe('Test');
    expect(project.canvas.size).toBe(512);

    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('inspect command reads project metadata', async () => {
    const projectPath = createTestProject();

    const { inspectCommand } = await import('../src/commands/inspect');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    await inspectCommand([projectPath]);
    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('CLI Test');
    expect(output).toContain('512');

    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('audit command validates project', async () => {
    const projectPath = createTestProject();

    const { auditCommand } = await import('../src/commands/audit');

    const logs: string[] = [];
    const originalLog = console.log;
    const originalExit = process.exit;
    console.log = (msg: string) => logs.push(msg);
    (process as any).exit = (code: number) => { throw new Error(`exit:${code}`); };

    try {
      await auditCommand([projectPath]);
    } catch (e) {
      // Expected exit
    }

    console.log = originalLog;
    (process as any).exit = originalExit;

    const output = logs.join('\n');
    expect(output).toContain('CLI Test');
    expect(output).toContain('Score');

    rmSync(TMP_DIR, { recursive: true, force: true });
  });
});