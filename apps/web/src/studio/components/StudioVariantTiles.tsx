import type { CanvasMaskShape, IconVariant } from '@iconcore/shared';
import { resolveMaskRadius } from '@iconcore/shared';
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
 * Each tile is a thumbnail of the **file**: it carries the canvas frame's own
 * shape and radius — `resolveMaskRadius`, the same resolver the export mask
 * reads — scaled to the tile side, and asks the preview to clip the bitmap to
 * that outline. The CSS border-radius is the same scaled number, so the empty
 * state (no bitmap yet) and the loaded image present one frame, not two.
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

/** Side of `.studio-tile img` / `.studio-tile-empty`, in `studio.css`. */
const TILE_SIDE = 49;

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
  const project = state.project;
  // The document's shape wins; the toolbar's choice covers a project that
  // never declared one — the same precedence the central frame uses.
  const maskShape: CanvasMaskShape = project?.canvas.maskShape ?? state.maskShape ?? 'rounded-rectangle';
  const radius = project ? resolveMaskRadius({ ...project.canvas, maskShape }) : 0;
  const canvasSize = project?.canvas.size ?? 0;
  const tileRadius = canvasSize > 0 ? (radius / canvasSize) * TILE_SIDE : 0;
  const url = useStudioPreview(project, variant, background, maskShape);
  return (
    <button type="button" className="studio-tile" data-active={active} onClick={onSelect} aria-pressed={active}>
      {url ? (
        <img src={url} alt="" draggable={false} style={{ borderRadius: tileRadius }} />
      ) : (
        <span className="studio-tile-empty" aria-hidden="true" style={{ borderRadius: tileRadius }} />
      )}
      <span>{label}</span>
      {active && <span className="studio-tile-dot" aria-hidden="true" />}
    </button>
  );
};
