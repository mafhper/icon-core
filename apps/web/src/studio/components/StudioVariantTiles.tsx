import type { IconVariant } from '@iconcore/shared';
import type { RenderBackground } from '@iconcore/renderer';
import { useComposer } from '../../composer/ComposerContext';
import { useStudioPreview } from '../useStudioPreview';
import { variantTiles } from '../variantLabels';

/**
 * Live variant tiles, shared by the canvas stage and the Inspector Export
 * tab: one implementation, so the two surfaces can never disagree about what
 * a variant looks like. Each tile renders the real pipeline (not a tinted
 * guess), and switching never touches layers, zoom or selection — the
 * orientation survives by construction.
 *
 * `background` is the `renderProject` mode the tiles paint. The stage and the
 * grid default to the editor picture (`'canvas'`); the export dialog passes
 * the mode its transparency switch selects, so Preview/Export is the file,
 * not the editor.
 */
export const StudioVariantTiles = ({ grid = false, background = 'canvas' }: { grid?: boolean; background?: RenderBackground }) => {
  const { state, dispatch } = useComposer();
  return (
    <div className={grid ? 'studio-tiles studio-tiles-grid' : 'studio-tiles'} role="group" aria-label="Appearance variants">
      {variantTiles().map((tile) => (
        <VariantTile
          key={tile.id}
          variant={tile.id}
          label={tile.label}
          active={state.activeVariant === tile.id}
          background={background}
          onSelect={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: tile.id })}
        />
      ))}
    </div>
  );
};

const VariantTile = ({
  variant,
  label,
  active,
  background,
  onSelect
}: {
  variant: IconVariant;
  label: string;
  active: boolean;
  background: RenderBackground;
  onSelect: () => void;
}) => {
  const { state } = useComposer();
  const url = useStudioPreview(state.project, variant, background);
  return (
    <button type="button" className="studio-tile" data-active={active} onClick={onSelect} aria-pressed={active}>
      {url ? <img src={url} alt="" draggable={false} /> : <span className="studio-tile-empty" aria-hidden="true" />}
      <span>{label}</span>
      {active && <span className="studio-tile-dot" aria-hidden="true" />}
    </button>
  );
};
