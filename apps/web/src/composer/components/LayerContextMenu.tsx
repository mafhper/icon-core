import { useEffect } from 'react';
import type { ComposerAction } from '../composerReducer';
import { useComposer } from '../ComposerContext';

interface LayerContextMenuProps {
  x: number;
  y: number;
  layerId: string;
  onClose: () => void;
}

/**
 * Right-click menu for a layer, shared by the canvas and the sidebar layer list.
 * Self-manages dismissal (outside pointer, Escape, scroll, resize) and is
 * fixed-positioned at the cursor, so it works identically wherever it's mounted.
 */
export const LayerContextMenu = ({ x, y, layerId, onClose }: LayerContextMenuProps) => {
  const { state, dispatch } = useComposer();
  const layer = state.project?.layers.find((item) => item.id === layerId);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!layer) return null;

  const run = (action: ComposerAction) => {
    dispatch(action);
    onClose();
  };

  return (
    <div
      className="ic-context-menu"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <strong>{layer.name}</strong>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
          dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: layer.id } });
          onClose();
        }}
      >
        Rename
      </button>
      <button type="button" onClick={() => run({ type: 'DUPLICATE_LAYER', payload: { id: layer.id } })}>Duplicate</button>
      <button type="button" onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'front' } })}>Bring to Front</button>
      <button type="button" onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'forward' } })}>Bring Forward</button>
      <button type="button" onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'backward' } })}>Send Backward</button>
      <button type="button" onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'back' } })}>Send to Back</button>
      <button type="button" onClick={() => run({ type: 'TOGGLE_LAYER_LOCK', payload: { id: layer.id } })}>{layer.locked ? 'Unlock' : 'Lock'}</button>
      <button type="button" onClick={() => run({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: layer.id } })}>{layer.visible ? 'Hide' : 'Show'}</button>
      <button type="button" onClick={() => run({ type: 'RESET_LAYER_TRANSFORM', payload: { id: layer.id } })}>Reset Transform</button>
      <button type="button" className="is-danger" onClick={() => run({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}>Delete</button>
    </div>
  );
};
