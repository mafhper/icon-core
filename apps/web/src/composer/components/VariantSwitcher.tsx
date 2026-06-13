import { useComposer } from '../ComposerContext';
import type { IconVariant } from '@iconcore/shared';

const VARIANTS: { id: IconVariant; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Mono' }
];

export const VariantSwitcher = () => {
  const { state, dispatch } = useComposer();

  return (
    <div className="ic-variant-switcher" aria-label="Icon variants">
      {VARIANTS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: v.id })}
          className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-[0.08em] transition ${
            state.activeVariant === v.id
              ? 'bg-core-accent/20 text-core-accent'
              : 'text-core-muted hover:text-core-text hover:bg-core-elevated'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
};
