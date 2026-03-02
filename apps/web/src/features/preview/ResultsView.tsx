import type { IconManifest, OutputEntry } from '@iconcore/engine';
import type { OutputMode } from '@iconcore/shared';
import type { GeneratedArtifact } from '../../types';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';

interface ResultsViewProps {
  generated: GeneratedArtifact[];
  mode: OutputMode | null;
  outputMap: OutputEntry[];
  manifest: IconManifest | null;
  t: (key: any) => string;
}

const formatSize = (value: number) => {
  if (value > 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

export const ResultsView = ({
  generated,
  mode,
  outputMap,
  manifest,
  t
}: ResultsViewProps) => {
  if (generated.length === 0) {
    return (
      <section className="empty-state card-surface rounded-2xl border border-core-border bg-core-surface/80 p-8 md:p-10">
        <div className="empty-state-grid">
          <div className="empty-copy">
            <p className="mono text-[11px] uppercase tracking-[0.16em] text-core-muted">IconCore workflow</p>
            <h2 className="font-display text-2xl leading-tight md:text-3xl">{t('emptyTitle')}</h2>
            <ul className="space-y-2 text-sm text-core-muted">
              <li>{t('emptyStep1')}</li>
              <li>{t('emptyStep2')}</li>
              <li>{t('emptyStep3')}</li>
            </ul>
          </div>
          <div className="empty-logo-stage">
            <AnimatedIconCoreLogo className="empty-logo-svg" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="card-surface space-y-4 rounded-2xl border border-core-border bg-core-surface p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg uppercase tracking-[0.14em]">{generated.length} assets</h2>
            <p className="text-xs text-core-muted">{mode === 'themed' ? t('modeThemed') : t('modeDefault')}</p>
          </div>
        </div>

        {manifest && (
          <pre className="max-h-48 overflow-auto rounded-xl border border-core-border bg-core-elevated p-3 text-xs text-core-muted">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {generated.map((item) => (
          <article key={item.id} className="card-surface rounded-xl border border-core-border bg-core-surface p-3">
            <div className="checkerboard flex h-36 items-center justify-center rounded-lg border border-core-border">
              <img src={item.url} alt={item.name} className="max-h-28 max-w-[80%] object-contain" />
            </div>
            <div className="mt-3 space-y-1">
              <p className="truncate font-mono text-[11px] text-core-muted">{item.name}</p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase text-core-muted">{item.variant}</span>
                <span className="font-mono text-core-muted">{formatSize(item.size)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="card-surface rounded-2xl border border-core-border bg-core-surface p-5 shadow-panel">
        <h3 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-core-accent">{t('outputStructure')}</h3>
        <ul className="grid gap-2 text-xs text-core-muted md:grid-cols-2">
          {outputMap.map((entry) => (
            <li key={entry.path} className="flex items-center justify-between rounded-lg border border-core-border bg-core-elevated px-3 py-2">
              <span className="font-mono">{entry.path}</span>
              <span className="uppercase">{entry.variant}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};
