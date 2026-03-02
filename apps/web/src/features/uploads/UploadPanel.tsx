import { Sun, Moon, ImagePlus, Palette, Image } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MasterSourceMode, UploadSlot, UploadState } from '../../types';

interface SlotConfig {
  id: UploadSlot;
  label: string;
  suggested: string;
  icon: ReactNode;
  required?: boolean;
}

const slotConfigs: SlotConfig[] = [
  { id: 'master', label: 'uploadMaster', suggested: '1024x1024', icon: <ImagePlus size={16} />, required: true },
  { id: 'light', label: 'uploadLight', suggested: '1024x1024', icon: <Sun size={16} /> },
  { id: 'dark', label: 'uploadDark', suggested: '1024x1024', icon: <Moon size={16} /> },
  { id: 'favicon', label: 'uploadFavicon', suggested: '512x512', icon: <Image size={16} /> },
  { id: 'faviconLight', label: 'uploadFaviconLight', suggested: '512x512', icon: <Sun size={16} /> },
  { id: 'faviconDark', label: 'uploadFaviconDark', suggested: '512x512', icon: <Moon size={16} /> },
  { id: 'socialBackground', label: 'uploadSocialBackground', suggested: '1200x630', icon: <Palette size={16} /> }
];

interface UploadPanelProps {
  uploads: UploadState;
  masterSourceMode: MasterSourceMode;
  t: (key: any) => string;
  onSelect: (slot: UploadSlot, file: File) => void;
  onClear: (slot: UploadSlot) => void;
  onMasterSourceModeChange: (mode: MasterSourceMode) => void;
}

const masterSourceModes: Array<{ id: MasterSourceMode; key: string }> = [
  { id: 'default', key: 'masterModeDefault' },
  { id: 'both', key: 'masterModeBoth' },
  { id: 'light', key: 'masterModeLight' },
  { id: 'dark', key: 'masterModeDark' }
];

export const UploadPanel = ({
  uploads,
  masterSourceMode,
  t,
  onSelect,
  onClear,
  onMasterSourceModeChange
}: UploadPanelProps) => {
  const isSlotDisabled = (slot: UploadSlot) => {
    if (slot === 'light') return masterSourceMode === 'light' || masterSourceMode === 'both';
    if (slot === 'dark') return masterSourceMode === 'dark' || masterSourceMode === 'both';
    return false;
  };

  return (
    <section className="card-surface space-y-4 rounded-2xl border border-core-border bg-core-surface p-5 shadow-panel">
      <div>
        <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">Assets</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {slotConfigs.map((slot) => {
          const upload = uploads[slot.id];
          const disabled = isSlotDisabled(slot.id);
          return (
            <label
              key={slot.id}
              className={`group relative flex min-h-28 flex-col justify-between rounded-xl border border-core-border bg-core-elevated p-3 transition ${
                disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-core-accent'
              }`}
            >
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={disabled}
                onChange={(event) => {
                  if (disabled) return;
                  const file = event.target.files?.[0];
                  if (file) onSelect(slot.id, file);
                }}
              />

              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-core-muted">
                <span>{t(slot.label as never)}{slot.required ? ' *' : ''}</span>
                <span className="font-mono text-[10px]">{t('suggested')} {slot.suggested}</span>
              </div>

              {upload.previewUrl ? (
                <div className="relative mt-3 h-24 overflow-hidden rounded-lg checkerboard">
                  <img src={upload.previewUrl} alt={slot.id} className="h-full w-full object-contain p-2" />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      onClear(slot.id);
                    }}
                    className="absolute right-2 top-2 rounded-md border border-core-border bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                  >
                    clear
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-core-border text-core-muted transition group-hover:text-core-accent">
                  {disabled ? <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{t('autoFromMaster')}</span> : slot.icon}
                </div>
              )}

              {slot.id === 'master' && (
                <div className="mt-3 grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-core-muted">{t('masterScope')}</span>
                  <div className="grid grid-cols-2 gap-1">
                    {masterSourceModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          onMasterSourceModeChange(mode.id);
                        }}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] ${
                          masterSourceMode === mode.id
                            ? 'border-core-accent bg-core-accent text-[color:var(--core-on-accent)]'
                            : 'border-core-border bg-core-surface text-core-muted'
                        }`}
                      >
                        {t(mode.key as never)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
};
