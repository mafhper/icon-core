import { resolveSize } from '@iconcore/shared';
import { useComposer } from '../../composer/ComposerContext';
import { variantLabel } from '../variantLabels';

/**
 * Studio canvas caption (mockup `canvas-caption`): dot, sRGB, canvas
 * dimensions, variant appearance — in that order.
 *
 * A readout, not a control: it names the profile, the size and the variant
 * the tiles below switch. No project yet (the welcome modal owns the screen
 * then) reads an honest em-dash, never a guessed size.
 */
export const StudioCanvasCaption = () => {
  const { state } = useComposer();
  const canvas = state.project ? resolveSize(state.project.canvas) : null;
  return (
    <p className="studio-caption">
      <span className="studio-caption-dot" aria-hidden="true" />
      <span>sRGB</span>
      <span aria-hidden="true">·</span>
      <span>{canvas ? `${canvas.width} × ${canvas.height} px` : '—'}</span>
      <span aria-hidden="true">·</span>
      <span>{`${variantLabel(state.activeVariant)} appearance`}</span>
    </p>
  );
};
