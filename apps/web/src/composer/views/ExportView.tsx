import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Check, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { createCanvasBackend } from '@iconcore/renderer';
import { exportTarget, generateReport, getAllTargets } from '@iconcore/exporters';
import type { IconTarget } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TARGETS = getAllTargets();

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';

interface ExportProgress {
  phase: ExportPhase;
  currentTask: number;
  totalTasks: number;
  currentTarget: string;
  currentSize: number;
}

const getTargetSizes = (target: (typeof TARGETS)[number]): number[] => {
  return [...new Set(target.tasks.map((task) => task.width))].sort((a, b) => a - b);
};

const getManifestFileName = (target: IconTarget): string => {
  if (target === 'web-favicon') return 'site.webmanifest';
  if (target === 'pwa') return 'manifest.webmanifest';
  return 'manifest.json';
};

const generateReadme = (projectName: string, targets: typeof TARGETS, selected: Set<IconTarget>) => {
  const selectedTargets = targets.filter(t => selected.has(t.id));
  return `# ${projectName} - Icon Pack

Generated with IconCore Composer

## Contents

${selectedTargets.map(t => `- **${t.name}** (${getTargetSizes(t).map(s => `${s}x${s}`).join(', ')})`).join('\n')}

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
Generated assets are free to use in personal and commercial projects.
`;
};

export const ExportView = () => {
  const { state, dispatch } = useComposer();
  const [selectedTargets, setSelectedTargets] = useState<Set<IconTarget>>(new Set(['web-favicon']));
  const [progress, setProgress] = useState<ExportProgress>({ phase: 'idle', currentTask: 0, totalTasks: 0, currentTarget: '', currentSize: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const projectName = state.project?.metadata.name ?? 'icon';

  const toggleTarget = (id: IconTarget) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDefinitions = useMemo(
    () => TARGETS.filter(t => selectedTargets.has(t.id)),
    [selectedTargets]
  );

  const totalTasks = useMemo(
    () => selectedDefinitions.reduce((sum, t) => sum + t.tasks.length, 0),
    [selectedDefinitions]
  );

  const totalFilesLabel = useMemo(
    () => selectedDefinitions.reduce((sum, t) => sum + t.tasks.length + 1 + (t.manifest ? 1 : 0), 0),
    [selectedDefinitions]
  );

  const selectedTargetLabels = useMemo(
    () => new Map(TARGETS.map((target) => [target.id, target.name])),
    [selectedTargets]
  );

  const handleExport = async () => {
    if (!state.project || selectedTargets.size === 0) return;

    setError(null);
    setProgress({ phase: 'exporting', currentTask: 0, totalTasks, currentTarget: '', currentSize: 0 });
    setElapsed(0);

    const startTime = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);

    try {
      const zip = new JSZip();
      const backend = createCanvasBackend();
      let completed = 0;
      const allWarnings: string[] = [];

      try {
        for (const target of selectedDefinitions) {
          setProgress({
            phase: 'exporting',
            currentTask: completed,
            totalTasks,
            currentTarget: target.name,
            currentSize: 0
          });

          const result = await exportTarget(state.project, target.id, state.activeVariant, backend);
          const folder = zip.folder(target.id)!;

          for (const file of result.files) {
            folder.file(file.path, file.blob);
          }

          if (result.manifest) {
            folder.file(getManifestFileName(target.id), JSON.stringify(result.manifest, null, 2));
          }

          const report = generateReport(result, state.project, state.activeVariant);
          folder.file('iconcore-report.json', JSON.stringify(report, null, 2));
          allWarnings.push(...result.warnings.map((warning) => `${target.name}: ${warning}`));

          completed += target.tasks.length;
        }
      } finally {
        backend.destroy();
      }

      setProgress({ phase: 'archiving', currentTask: totalTasks, totalTasks, currentTarget: '', currentSize: 0 });
      zip.file('README.md', generateReadme(projectName, TARGETS, selectedTargets));
      if (allWarnings.length > 0) {
        zip.file('WARNINGS.txt', allWarnings.join('\n'));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${state.project.exportProfile.outputBaseName}-icons.zip`);

      setProgress({ phase: 'complete', currentTask: totalTasks, totalTasks, currentTarget: '', currentSize: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setProgress({ phase: 'error', currentTask: 0, totalTasks, currentTarget: '', currentSize: 0 });
    } finally {
      clearInterval(timer);
    }
  };

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => dispatch({ type: 'NAVIGATE', payload: 'compose' })}
          className="inline-flex items-center gap-2 text-sm text-core-muted hover:text-core-text transition"
        >
          <ArrowLeft size={16} />
          Back to Composer
        </button>

        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.18em] mb-2">
            Export Icons
          </h1>
          <p className="text-sm text-core-muted">
            Select the targets you want to export. You will receive a ZIP with PNGs, a manifest, and usage instructions.
          </p>
        </div>

        <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">
              Export Targets
            </h2>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setSelectedTargets(new Set(TARGETS.map(t => t.id)));
                } else if (val === 'web') {
                  setSelectedTargets(new Set(['web-favicon', 'pwa']));
                } else if (val === 'desktop') {
                  setSelectedTargets(new Set(['tauri', 'electron', 'desktop-generic']));
                } else {
                  setSelectedTargets(new Set(['web-favicon']));
                }
              }}
              className="text-xs py-1.5 px-2 rounded-lg"
            >
              <option value="">Quick select...</option>
              <option value="all">All targets</option>
              <option value="web">Web only (favicon + PWA)</option>
              <option value="desktop">Desktop (Tauri + Electron)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TARGETS.map((target) => (
              <label
                key={target.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  selectedTargets.has(target.id)
                    ? 'border-core-accent bg-core-accent/10'
                    : 'border-core-border hover:border-core-accent/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTargets.has(target.id)}
                  onChange={() => toggleTarget(target.id)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{target.name}</p>
                  <p className="text-xs text-core-muted">
                    {target.tasks.length} files
                  </p>
                </div>
                {selectedTargets.has(target.id) && (
                  <Check size={16} className="text-core-accent shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>

        {(progress.phase !== 'idle' && progress.phase !== 'complete') && (
          <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {progress.phase === 'exporting' && <Loader2 size={20} className="animate-spin text-core-accent" />}
                {progress.phase === 'archiving' && <FileText size={20} className="text-core-accent composer-pulse" />}
                <div>
                  <p className="text-sm font-semibold">
                    {progress.phase === 'exporting' && `Exporting ${progress.currentTarget}`}
                    {progress.phase === 'archiving' && 'Packaging ZIP archive...'}
                    {progress.phase === 'error' && 'Export failed'}
                  </p>
                  <p className="text-xs text-core-muted">
                    {progress.currentTask} / {progress.totalTasks} render tasks
                    {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-mono tabular-nums">
                {totalTasks > 0 ? Math.round((progress.currentTask / totalTasks) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-core-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-core-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalTasks > 0 ? (progress.currentTask / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {progress.phase === 'complete' && (
          <div className="card-surface rounded-2xl border border-core-success/50 bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-core-success/20 flex items-center justify-center">
                <Check size={20} className="text-core-success" />
              </div>
              <div>
                <p className="text-sm font-semibold">Export complete!</p>
                <p className="text-xs text-core-muted">
                  {totalFilesLabel} files exported · {formatElapsed(elapsed)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-surface rounded-2xl border border-core-danger/50 bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-core-danger" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={selectedTargets.size === 0 || progress.phase === 'exporting' || progress.phase === 'archiving'}
          className="w-full core-btn core-btn-primary inline-flex items-center justify-center gap-2 rounded-xl border border-core-border px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          {progress.phase === 'exporting' || progress.phase === 'archiving'
            ? 'Exporting...'
            : progress.phase === 'complete'
              ? 'Export Again'
              : `Export ZIP (${totalFilesLabel} files)`}
        </button>
      </div>
    </div>
  );
};
