import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UiTheme } from '@iconcore/shared';
import type { AppPreferences } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  themePreference: 'auto' | UiTheme;
  preferences: AppPreferences;
  t: (key: any) => string;
  onClose: () => void;
  onSave: (next: { themePreference: 'auto' | UiTheme; preferences: AppPreferences }) => void;
}

const themeCards: Array<{ id: 'auto' | UiTheme; tone: string; labelKey: string }> = [
  { id: 'auto', tone: 'system', labelKey: 'themeAuto' },
  { id: 'dark', tone: 'dark', labelKey: 'themeDark' },
  { id: 'light', tone: 'light', labelKey: 'themeLight' },
  { id: 'gold', tone: 'gold', labelKey: 'themeGold' }
];

export const SettingsModal = ({
  isOpen,
  themePreference,
  preferences,
  t,
  onClose,
  onSave
}: SettingsModalProps) => {
  const [draftTheme, setDraftTheme] = useState<'auto' | UiTheme>(themePreference);
  const [draftPreferences, setDraftPreferences] = useState<AppPreferences>(preferences);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTheme(themePreference);
    setDraftPreferences(preferences);
  }, [isOpen, themePreference, preferences]);

  useEffect(() => {
    if (!isOpen) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t('settingsTitle')}>
      <div className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <h2>{t('settingsTitle')}</h2>
            <p>{t('settingsSubtitle')}</p>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-section">
          <h3>{t('appearance')}</h3>
          <p>{t('appearanceHint')}</p>
          <div className="theme-grid">
            {themeCards.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setDraftTheme(item.id)}
                className={`theme-chip ${item.tone} ${draftTheme === item.id ? 'selected' : ''}`}
              >
                <span className="theme-chip-label">{t(item.labelKey as never)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>{t('outputOptions')}</h3>
          <p>{t('outputHint')}</p>

          <label className="settings-field">
            <span>{t('outputMode')}</span>
            <select
              value={draftPreferences.outputMode}
              onChange={(event) =>
                setDraftPreferences((previous) => ({
                  ...previous,
                  outputMode: event.target.value as AppPreferences['outputMode']
                }))
              }
            >
              <option value="auto">{t('outputModeAuto')}</option>
              <option value="default">{t('outputModeDefault')}</option>
              <option value="themed">{t('outputModeThemed')}</option>
            </select>
          </label>

          <label className="settings-field">
            <span>{t('outputLayout')}</span>
            <select
              value={draftPreferences.outputStructure}
              onChange={(event) =>
                setDraftPreferences((previous) => ({
                  ...previous,
                  outputStructure: event.target.value as AppPreferences['outputStructure']
                }))
              }
            >
              <option value="standard">{t('outputLayoutStandard')}</option>
              <option value="flat">{t('outputLayoutFlat')}</option>
            </select>
          </label>

          <label className="settings-field">
            <span>{t('archiveName')}</span>
            <input
              value={draftPreferences.archiveName}
              onChange={(event) =>
                setDraftPreferences((previous) => ({
                  ...previous,
                  archiveName: event.target.value
                }))
              }
            />
          </label>
        </div>

        <div className="settings-section">
          <h3>{t('formatVisibility')}</h3>
          <div className="settings-list">
            <label className="settings-toggle">
              <span>{t('includeLogoSvg')}</span>
              <input
                type="checkbox"
                checked={draftPreferences.includeLogoSvg}
                onChange={(event) =>
                  setDraftPreferences((previous) => ({
                    ...previous,
                    includeLogoSvg: event.target.checked
                  }))
                }
              />
            </label>
            <label className="settings-toggle">
              <span>{t('includeFaviconSvg')}</span>
              <input
                type="checkbox"
                checked={draftPreferences.includeFaviconSvg}
                onChange={(event) =>
                  setDraftPreferences((previous) => ({
                    ...previous,
                    includeFaviconSvg: event.target.checked
                  }))
                }
              />
            </label>
            <label className="settings-toggle">
              <span>{t('includeIco')}</span>
              <input
                type="checkbox"
                checked={draftPreferences.includeIco}
                onChange={(event) =>
                  setDraftPreferences((previous) => ({
                    ...previous,
                    includeIco: event.target.checked
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-btn subtle" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="settings-btn primary"
            onClick={() => onSave({ themePreference: draftTheme, preferences: draftPreferences })}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
