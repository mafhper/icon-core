import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Check, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TARGETS = [
  { id: 'web-favicon', name: 'Web Favicon', sizes: [16, 32, 48, 180] },
  { id: 'pwa', name: 'PWA Icons', sizes: [192, 512] },
  { id: 'tauri', name: 'Tauri App', sizes: [32, 128, 256, 512] },
  { id: 'electron', name: 'Electron', sizes: [256, 512] },
  { id: 'marketing', name: 'Marketing', sizes: [256, 512, 1024] }
] as const;

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';

interface ExportProgress {
  phase: ExportPhase;
  currentTask: number;
  totalTasks: number;
  currentTarget: string;
  currentSize: number;
}

const generateReadme = (projectName: string, targets: readonly { id: string; name: string; sizes: readonly number[] }[], selected: Set<string>) => {
  const selectedTargets = targets.filter(t => selected.has(t.id));
  return `# ${projectName} - Icon Pack

Generated with IconCore Composer

## Contents

${selectedTargets.map(t => `- **${t.name}** (${t.sizes.map(s => `${s}x${s}`).join(', ')})`).join('\n')}

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
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set(['web-favicon']));
  const [progress, setProgress] = useState<ExportProgress>({ phase: 'idle', currentTask: 0, totalTasks: 0, currentTarget: '', currentSize: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const projectName = state.project?.metadata.name ?? 'icon';

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSizes = useMemo(
    () => TARGETS.filter(t => selectedTargets.has(t.id)).reduce((sum, t) => sum + t.sizes.length, 0),
    [selectedTargets]
  );

  const handleExport = async () => {
    if (!state.project || selectedTargets.size === 0) return;

    setError(null);
    setProgress({ phase: 'exporting', currentTask: 0, totalTasks: totalSizes, currentTarget: '', currentSize: 0 });
    setElapsed(0);

    const startTime = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);

    try {
      const zip = new JSZip();
      const backend = createCanvasBackend();
      const targets = TARGETS.filter(t => selectedTargets.has(t.id));
      let completed = 0;

      for (const target of targets) {
        const folder = zip.folder(target.id)!;

        for (const size of target.sizes) {
          setProgress({ phase: 'exporting', currentTask: completed, totalTasks: totalSizes, currentTarget: target.name, currentSize: size });

          const blob = await renderProject(
            state.project!,
            state.activeVariant,
            size,
            backend
          );

          const filename = `icon-${size}x${size}.png`;
          folder.file(filename, blob);
          completed++;
        }
      }

      setProgress({ phase: 'archiving', currentTask: totalSizes, totalTasks: totalSizes, currentTarget: '', currentSize: 0 });

      const manifest = {
        name: projectName,
        short_name: state.project.metadata.shortName,
        icons: targets.flatMap(t =>
          t.sizes.map(s => ({
            src: `${t.id}/icon-${s}x${s}.png`,
            sizes: `${s}x${s}`,
            type: 'image/png'
          }))
        )
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('README.md', generateReadme(projectName, TARGETS, selectedTargets));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${state.project.exportProfile.outputBaseName}-icons.zip`);

      setProgress({ phase: 'complete', currentTask: totalSizes, totalTasks: totalSizes, currentTarget: '', currentSize: 0 });
      backend.destroy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setProgress({ phase: 'error', currentTask: 0, totalTasks: totalSizes, currentTarget: '', currentSize: 0 });
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
                  setSelectedTargets(new Set(['tauri', 'electron']));
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
                    {target.sizes.length} sizes
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
                    {progress.phase === 'exporting' && `Exporting ${progress.currentTarget} (${progress.currentSize}px)`}
                    {progress.phase === 'archiving' && 'Packaging ZIP archive...'}
                    {progress.phase === 'error' && 'Export failed'}
                  </p>
                  <p className="text-xs text-core-muted">
                    {progress.currentTask} / {progress.totalTasks} icons
                    {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-mono tabular-nums">
                {totalSizes > 0 ? Math.round((progress.currentTask / totalSizes) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-core-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-core-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalSizes > 0 ? (progress.currentTask / totalSizes) * 100 : 0}%` }}
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
                  {totalSizes} icons exported · {formatElapsed(elapsed)}
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
              : `Export ZIP (${totalSizes} icons)`}
        </button>
      </div>
    </div>
  );
};