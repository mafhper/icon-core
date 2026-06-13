import { useEffect } from 'react';
import { useComposer } from '../ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch } from '../utils/layerEdit';

export const useKeyboardShortcuts = () => {
  const { state, dispatch, navigate } = useComposer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInput) return;

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      if (isMod && e.key === 's') {
        e.preventDefault();
        if (!state.project) return;
        const json = JSON.stringify(state.project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.project.metadata.name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;
        a.click();
        URL.revokeObjectURL(url);
        dispatch({ type: 'SET_DIRTY', payload: false });
        return;
      }

      if (isMod && e.key === 'l') {
        e.preventDefault();
        dispatch({ type: 'ADD_LAYER', payload: { shape: { kind: 'circle', width: 100, height: 100 } } });
        return;
      }

      if (isMod && e.key === 'd') {
        e.preventDefault();
        if (state.activeLayerId) {
          dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } });
        }
        return;
      }

      if (isMod && e.key === 'e') {
        e.preventDefault();
        navigate('export-utilities');
        return;
      }

      if (isMod && e.key === '=') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) });
        return;
      }

      if (isMod && e.key === '-') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) });
        return;
      }

      if (isMod && e.key === '0') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', payload: 1 });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.activeLayerId) {
          e.preventDefault();
          dispatch({ type: 'REMOVE_LAYER', payload: { id: state.activeLayerId } });
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.activeLayerId && state.project) {
        const baseLayer = state.project.layers.find((item) => item.id === state.activeLayerId);
        if (!baseLayer || baseLayer.locked) return;
        e.preventDefault();
        const layer = resolveLayerVariant(baseLayer, state.activeVariant);
        const amount = e.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: { x: 0, y: -amount },
          ArrowDown: { x: 0, y: amount },
          ArrowLeft: { x: -amount, y: 0 },
          ArrowRight: { x: amount, y: 0 }
        }[e.key]!;
        scopedLayerDispatch(dispatch, state.activeVariant, baseLayer.id, {
          transform: {
            ...layer.transform,
            x: layer.transform.x + delta.x,
            y: layer.transform.y + delta.y
          }
        });
        return;
      }

      if (e.key === 'g' && !isMod) {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_GRID' });
        return;
      }

      if (e.key === 'Escape') {
        dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: null } });
        return;
      }

      if (e.key === '1' && !isMod) {
        dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'default' });
        return;
      }
      if (e.key === '2' && !isMod) {
        dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'light' });
        return;
      }
      if (e.key === '3' && !isMod) {
        dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'dark' });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, dispatch, navigate]);
};
