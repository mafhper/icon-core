import { Download, Package, Settings2, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROJECT_CONFIG, type Locale, type UiTheme } from '@iconcore/shared';
import { getDominantColor } from '../lib/imageProcessor';
import type { AppPreferences, MasterSourceMode, UploadSlot, UploadState } from '../types';
import { createInitialUploads } from '../types';
import { exportAsZip } from '../features/export/exportHelpers';
import {
  remapArtifactsForExport,
  remapManifestForLayout,
  remapOutputMapForLayout,
  remapOutputPath
} from '../features/export/outputLayout';
import { useGeneration } from '../features/generation/useGeneration';
import { makeTranslator, getInitialLocale } from '../features/i18n/useI18n';
import { ProjectConfigPanel } from '../features/project-config/ProjectConfigPanel';
import { ResultsView } from '../features/preview/ResultsView';
import { ColorInputField } from '../features/settings/ColorInputField';
import { SettingsModal } from '../features/settings/SettingsModal';
import { UploadPanel } from '../features/uploads/UploadPanel';

const DEFAULT_PREFERENCES: AppPreferences = {
  outputMode: 'auto',
  includeLogoSvg: true,
  includeFaviconSvg: true,
  includeIco: true,
  outputStructure: 'standard',
  archiveName: 'iconcore-assets'
};

export const App = () => {
  const [locale] = useState<Locale>(() => getInitialLocale());
  const [themePreference, setThemePreference] = useState<'auto' | UiTheme>(() => {
    const stored = localStorage.getItem('iconcore-theme-preference');
    if (stored === 'auto' || stored === 'light' || stored === 'dark' || stored === 'gold') {
      return stored;
    }
    return 'auto';
  });
  const [projectConfig, setProjectConfig] = useState(DEFAULT_PROJECT_CONFIG);
  const [uploads, setUploads] = useState(createInitialUploads());
  const [masterSourceMode, setMasterSourceMode] = useState<MasterSourceMode>('default');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [settings, setSettings] = useState({
    logoPadding: 0,
    faviconPadding: 0,
    socialPadding: 0,
    transparentBackground: true,
    backgroundColor: '#0f0f11',
    darkBackgroundColor: '#050506',
    includeSocial: true
  });

  const { artifacts, manifest, outputMap, mode, isGenerating, error, generate } = useGeneration();

  const t = useMemo(() => makeTranslator(locale), [locale]);

  useEffect(() => {
    localStorage.setItem('iconcore-theme-preference', themePreference);
  }, [themePreference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const resolveTheme = (): UiTheme => {
      if (themePreference === 'auto') return mediaQuery.matches ? 'dark' : 'light';
      return themePreference;
    };

    const applyTheme = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme());
    };

    applyTheme();

    if (themePreference !== 'auto') return;

    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themePreference]);

  useEffect(() => {
    return () => {
      for (const entry of Object.values(uploads)) {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
    };
  }, [uploads]);

  const onSelect = (slot: UploadSlot, file: File) => {
    setUploads((previous) => {
      const current = previous[slot];
      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return {
        ...previous,
        [slot]: {
          file,
          previewUrl: URL.createObjectURL(file)
        }
      };
    });

    if (slot === 'master') {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        setSettings((previous) => ({ ...previous, backgroundColor: getDominantColor(img) }));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const onClear = (slot: UploadSlot) => {
    setUploads((previous) => {
      const current = previous[slot];
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...previous,
        [slot]: { file: null, previewUrl: null }
      };
    });
  };

  const effectiveUploads = useMemo<UploadState>(() => {
    if (!uploads.master.file) return uploads;

    const next = { ...uploads };
    if (masterSourceMode === 'light' || masterSourceMode === 'both') {
      next.light = uploads.master;
    }
    if (masterSourceMode === 'dark' || masterSourceMode === 'both') {
      next.dark = uploads.master;
    }
    return next;
  }, [uploads, masterSourceMode]);

  const handleGenerate = useCallback(async () => {
    await generate({
      uploads: effectiveUploads,
      projectConfig,
      settings,
      preferences
    });
  }, [generate, effectiveUploads, projectConfig, settings, preferences]);

  const handleMasterSourceModeChange = (mode: MasterSourceMode) => {
    setMasterSourceMode(mode);
    const shouldClearLight = mode === 'light' || mode === 'both';
    const shouldClearDark = mode === 'dark' || mode === 'both';

    if (!shouldClearLight && !shouldClearDark) return;

    setUploads((previous) => {
      const next = { ...previous };
      if (shouldClearLight) {
        if (next.light.previewUrl) URL.revokeObjectURL(next.light.previewUrl);
        next.light = { file: null, previewUrl: null };
      }
      if (shouldClearDark) {
        if (next.dark.previewUrl) URL.revokeObjectURL(next.dark.previewUrl);
        next.dark = { file: null, previewUrl: null };
      }
      return next;
    });
  };

  const layoutOptions = useMemo(
    () => ({
      outputStructure: preferences.outputStructure
    }),
    [preferences.outputStructure]
  );

  const outputMapForView = useMemo(
    () => remapOutputMapForLayout(outputMap, layoutOptions),
    [outputMap, layoutOptions]
  );

  const buildExportPayload = () => {
    if (!manifest || artifacts.length === 0) return null;

    return {
      files: remapArtifactsForExport(artifacts, layoutOptions),
      manifest: remapManifestForLayout(manifest, {
        outputStructure: preferences.outputStructure
      }),
      archiveName: preferences.archiveName,
      manifestPath: remapOutputPath('manifest.json', layoutOptions)
    };
  };

  const handleZipExport = async () => {
    const payload = buildExportPayload();
    if (!payload) return;
    await exportAsZip(payload);
  };

  return (
    <div className="min-h-screen text-core-text">
      <header className="sticky top-0 z-20 border-b border-core-border bg-core-bg/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em]">{t('appTitle')}</p>
            <p className="text-xs text-core-muted">{t('appSubtitle')}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZipExport}
              disabled={artifacts.length === 0 || isGenerating}
              className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border bg-core-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-core-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={14} />
              {t('exportAssets')}
            </button>
            {Object.values(uploads).some((entry) => Boolean(entry.file)) && (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!uploads.master.file || isGenerating}
                className="core-btn core-btn-primary inline-flex items-center gap-2 rounded-xl border border-core-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Package size={14} />
                {isGenerating ? t('generating') : t('generate')}
              </button>
            )}
            <button
              type="button"
              className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border bg-core-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-core-text transition hover:border-core-accent"
              onClick={() => setIsSettingsOpen(true)}
            >
              <SlidersHorizontal size={14} />
              {t('openSettings')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 md:grid-cols-[520px_1fr] md:px-6">
        <aside className="space-y-4">
          <UploadPanel
            uploads={uploads}
            masterSourceMode={masterSourceMode}
            t={t}
            onSelect={onSelect}
            onClear={onClear}
            onMasterSourceModeChange={handleMasterSourceModeChange}
          />
          <ProjectConfigPanel config={projectConfig} onChange={setProjectConfig} t={t} />

          <section className="card-surface space-y-4 rounded-2xl border border-core-border bg-core-surface p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-core-accent" />
              <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">{t('settings')}</h2>
            </div>

            <label className="grid gap-2 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">
                {t('paddingLogo')} ({Math.round(settings.logoPadding * 100)}%)
              </span>
              <input
                type="range"
                min="0"
                max="0.45"
                step="0.01"
                value={settings.logoPadding}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, logoPadding: Number(event.target.value) }))
                }
              />
            </label>

            <label className="grid gap-2 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">
                {t('paddingFavicon')} ({Math.round(settings.faviconPadding * 100)}%)
              </span>
              <input
                type="range"
                min="0"
                max="0.45"
                step="0.01"
                value={settings.faviconPadding}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, faviconPadding: Number(event.target.value) }))
                }
              />
            </label>

            <label className="grid gap-2 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">
                {t('paddingSocial')} ({Math.round(settings.socialPadding * 100)}%)
              </span>
              <input
                type="range"
                min="0"
                max="0.45"
                step="0.01"
                value={settings.socialPadding}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, socialPadding: Number(event.target.value) }))
                }
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <ColorInputField
                label={t('bgLight')}
                valueHex={settings.backgroundColor}
                onChangeHex={(value) => setSettings((previous) => ({ ...previous, backgroundColor: value }))}
              />

              <ColorInputField
                label={t('bgDark')}
                valueHex={settings.darkBackgroundColor}
                onChangeHex={(value) => setSettings((previous) => ({ ...previous, darkBackgroundColor: value }))}
              />
            </div>

            <label className="flex items-center justify-between rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-xs text-core-muted">
              {t('transparentBg')}
              <input
                type="checkbox"
                checked={settings.transparentBackground}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, transparentBackground: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-core-border bg-core-elevated px-3 py-2 text-xs text-core-muted">
              {t('includeSocial')}
              <input
                type="checkbox"
                checked={settings.includeSocial}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, includeSocial: event.target.checked }))
                }
              />
            </label>
          </section>

          {error && (
            <p className="rounded-xl border border-core-danger/50 bg-core-danger/10 p-3 text-xs text-core-danger">{error}</p>
          )}
        </aside>

        <div className="space-y-4">
          <ResultsView
            generated={artifacts}
            mode={mode}
            outputMap={outputMapForView}
            manifest={manifest ? remapManifestForLayout(manifest, { outputStructure: preferences.outputStructure }) : null}
            t={t}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        themePreference={themePreference}
        preferences={preferences}
        t={t}
        onClose={() => setIsSettingsOpen(false)}
        onSave={({ themePreference: nextTheme, preferences: nextPreferences }) => {
          setThemePreference(nextTheme);
          setPreferences(nextPreferences);
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
};
