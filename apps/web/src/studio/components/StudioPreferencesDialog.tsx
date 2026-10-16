import { useState } from 'react';
import { Button, SegmentedControl } from '@iconcore/ui';
import { StudioDialog } from './StudioDialog';
import {
  readThemePreference,
  writeThemePreference,
  type StudioThemePreference
} from '../useStudioTheme';

const OPTIONS: Array<{ value: StudioThemePreference; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
];

/**
 * Studio preferences (Fase 5): the settings that exist, nothing decorative.
 *
 * Today that is the theme preference — the same Light/Dark/System the
 * toolbar menu switches, persisted to the same key so the two stay one
 * setting. A preference that does not act would be worse than no dialog.
 */
export const StudioPreferencesDialog = ({
  preference,
  onPreference,
  onClose
}: {
  preference: StudioThemePreference;
  onPreference: (preference: StudioThemePreference) => void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState<StudioThemePreference>(preference ?? readThemePreference());

  return (
    <StudioDialog title="Preferences" onClose={onClose}>
      <h3 className="text-xs font-semibold text-ic-text-muted mt-1 mb-1">Theme</h3>
      <SegmentedControl
        aria-label="Theme"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next);
          writeThemePreference(next);
          onPreference(next);
        }}
      />
      <p className="text-xs text-ic-text-muted mt-2">
        System follows the operating system; the studio itself is dark-first.
      </p>
      <div className="studio-dialog-actions mt-4">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </StudioDialog>
  );
};
