import type { ProjectConfig } from '@iconcore/shared';

interface ProjectConfigPanelProps {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
  t: (key: any) => string;
}

export const ProjectConfigPanel = ({ config, onChange, t }: ProjectConfigPanelProps) => {
  return (
    <section className="card-surface space-y-4 rounded-2xl border border-core-border bg-core-surface p-5 shadow-panel">
      <div className="space-y-1">
        <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">{t('projectConfig')}</h2>
        <p className="text-xs text-core-muted">{t('appInfoSectionHint')}</p>
      </div>

      <div className="space-y-3">
        <label className="grid gap-1 text-xs">
          <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">{t('name')}</span>
          <input
            value={config.name}
            onChange={(event) => onChange({ ...config, name: event.target.value })}
            className="rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-sm outline-none focus:border-core-accent"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">{t('shortName')}</span>
            <input
              value={config.shortName}
              onChange={(event) => onChange({ ...config, shortName: event.target.value })}
              className="rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-sm outline-none focus:border-core-accent"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">{t('startUrl')}</span>
            <input
              value={config.startUrl}
              onChange={(event) => onChange({ ...config, startUrl: event.target.value })}
              className="rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-sm outline-none focus:border-core-accent"
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs">
          <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">{t('description')}</span>
          <textarea
            value={config.description}
            onChange={(event) => onChange({ ...config, description: event.target.value })}
            rows={3}
            className="rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-sm outline-none focus:border-core-accent"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-core-muted">{t('defaultTheme')}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => onChange({ ...config, defaultTheme: theme })}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  config.defaultTheme === theme
                    ? 'border-core-accent bg-core-accent text-[color:var(--core-on-accent)]'
                    : 'border-core-border bg-core-elevated text-core-muted'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
