import { Contrast, Image, Moon, Sun } from 'lucide-react';
import type { IconVariant } from '@iconcore/shared';
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
 */
export const AppearanceSwitcher = () => {
  const { state, dispatch } = useComposer();

  return (
    <div className="ic-toolbar-group" role="group" aria-label="Icon appearance variants">
      {APPEARANCES.map(({ id, label, icon: Icon }) => {
        const active = state.activeVariant === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: id })}
            className={`p-1.5 rounded ${active ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title={label}
            aria-label={label}
            aria-pressed={active}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};
