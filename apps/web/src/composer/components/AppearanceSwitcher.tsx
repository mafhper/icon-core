import { Contrast, Image, Moon, Sun } from 'lucide-react';
import type { IconVariant } from '@iconcore/shared';
import { IconButton, Tooltip } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';

const APPEARANCES: Array<{ id: IconVariant; label: string; icon: typeof Sun }> = [
  { id: 'default', label: 'Appearance: Default', icon: Image },
  { id: 'light', label: 'Appearance: Light', icon: Sun },
  { id: 'dark', label: 'Appearance: Dark', icon: Moon },
  { id: 'mono', label: 'Appearance: Mono', icon: Contrast }
];

/**
 * Appearance variant switcher for the app action bar (RuneIcons-style).
 * Uses distinct SVG icons per mode — default (image), light (sun), dark
 * (moon), mono (contrast) — so each variant is recognizable at a glance,
 * unlike rendered thumbnails which all looked identical.
 *
 * A6: migrated to kit `IconButton`s inside the parent `ButtonGroup`
 * (label "Appearance"); no wrapper div of its own anymore.
 */
export const AppearanceSwitcher = () => {
  const { state, dispatch } = useComposer();

  return (
    <>
      {APPEARANCES.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id} content={label}>
          <IconButton
            selected={state.activeVariant === id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: id })}
            icon={<Icon size={15} />}
            aria-label={label}
          />
        </Tooltip>
      ))}
    </>
  );
};
