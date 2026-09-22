import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ComposerAction } from '../composerReducer';
import { useComposer } from '../ComposerContext';

interface LayerContextMenuProps {
  x: number;
  y: number;
  layerId: string;
  onClose: () => void;
}

const MENU_MARGIN = 8;
const MENU_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/**
 * Right-click menu for a layer, shared by the canvas and the sidebar layer list.
 * Self-manages dismissal (outside pointer, Escape, scroll, resize) and is
 * fixed-positioned at the cursor — clamped to the viewport so a menu opened near
 * the right/bottom edge is never clipped off-screen.
 *
 * Keyboard: Shift+F10/ContextMenu opens it from the layer row, focus lands on the
 * first item, ArrowUp/Down (and Home/End) move, Escape/Tab close, and focus
 * returns to the element that opened it.
 */
export const LayerContextMenu = ({ x, y, layerId, onClose }: LayerContextMenuProps) => {
  const { state, dispatch } = useComposer();
  const layer = state.project?.layers.find((item) => item.id === layerId);
  const menuRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(MENU_MARGIN, Math.min(x, window.innerWidth - rect.width - MENU_MARGIN)),
      top: Math.max(MENU_MARGIN, Math.min(y, window.innerHeight - rect.height - MENU_MARGIN))
    });
  }, [x, y]);

  // Mount/unmount only: `onClose` is an inline arrow upstream, so depending on it
  // would re-run the cleanup (and steal focus) on every parent render.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const close = () => onCloseRef.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
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
      restoreFocusRef.current?.focus();
    };
  }, []);

  if (!layer) return null;

  const run = (action: ComposerAction) => {
    dispatch(action);
    onClose();
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      onClose();
      return;
    }
    if (!MENU_KEYS.includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' ? (index + 1 + items.length) % items.length
            : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${layer.name} actions`}
      tabIndex={-1}
      className="ic-context-menu"
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onMenuKeyDown}
    >
      <strong>{layer.name}</strong>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => {
        dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
        dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: layer.id } });
        onClose();
      }}>
        Rename
      </button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'DUPLICATE_LAYER', payload: { id: layer.id } })}>Duplicate</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'front' } })}>Bring to Front</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'forward' } })}>Bring Forward</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'backward' } })}>Send Backward</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'MOVE_LAYER', payload: { id: layer.id, direction: 'back' } })}>Send to Back</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'TOGGLE_LAYER_LOCK', payload: { id: layer.id } })}>{layer.locked ? 'Unlock' : 'Lock'}</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: layer.id } })}>{layer.visible ? 'Hide' : 'Show'}</button>
      <button role="menuitem" type="button" tabIndex={-1} onClick={() => run({ type: 'RESET_LAYER_TRANSFORM', payload: { id: layer.id } })}>Reset Transform</button>
      <button role="menuitem" type="button" tabIndex={-1} className="is-danger" onClick={() => run({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}>Delete</button>
    </div>
  );
};
