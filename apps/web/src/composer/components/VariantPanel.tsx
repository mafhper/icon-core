import { Sparkles, RotateCcw, Layers2, ArrowUpToLine } from 'lucide-react';
import { withIconStroke } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { isGeneratableVariant } from '../utils/variantPresets';

export const VariantPanel = () => {
  const { state, dispatch } = useComposer();
  const toast = useToast();
  const variant = state.activeVariant;

  if (!state.project || variant === 'default' || !isGeneratableVariant(variant)) return null;

  const label = variant.charAt(0).toUpperCase() + variant.slice(1);

  return (
    <div className="ic-variant-panel" role="group" aria-label={`${label} variant tools`}>
      <span className="ic-variant-panel-label">{label} variant</span>
      <button
        type="button"
        className="ic-variant-action"
        onClick={() => {
          dispatch({ type: 'GENERATE_VARIANT', payload: { variant } });
          toast.success(`${label} variant generated from default`);
        }}
        title="Auto-generate this variant's colors from the default"
      >
        {withIconStroke(<Sparkles size={13} />, 'semibold')}
        <span>Generate from default</span>
      </button>
      <button
        type="button"
        className="ic-variant-action"
        onClick={() => {
          dispatch({ type: 'CLEAR_VARIANT', payload: { variant } });
          toast.info(`${label} variant reset to default`);
        }}
        title="Remove this variant's overrides"
      >
        {withIconStroke(<RotateCcw size={13} />, 'semibold')}
        <span>Reset</span>
      </button>
      <button
        type="button"
        className="ic-variant-action"
        onClick={() => {
          dispatch({ type: 'PROMOTE_VARIANT', payload: { variant } });
          toast.success(`${label} changes applied to the base (all variants)`);
        }}
        title="Merge this variant's changes into the base layer, applying them to all variants"
      >
        {withIconStroke(<ArrowUpToLine size={13} />, 'semibold')}
        <span>Apply to base</span>
      </button>
      <button
        type="button"
        className={`ic-variant-action ${state.compareDefault ? 'is-active' : ''}`}
        onClick={() => dispatch({ type: 'TOGGLE_COMPARE_DEFAULT' })}
        title="Show the default as a faint overlay for comparison"
        aria-pressed={state.compareDefault}
      >
        {withIconStroke(<Layers2 size={13} />, 'semibold')}
        <span>Compare default</span>
      </button>
    </div>
  );
};
