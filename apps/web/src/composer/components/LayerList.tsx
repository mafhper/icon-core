import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { QualityWarnings } from './QualityWarnings';
import { LayerContextMenu } from './LayerContextMenu';

export const LayerList = () => {
  const { state, dispatch } = useComposer();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);

  const project = state.project;
  // Displayed top-to-bottom in descending zIndex (top of the list = front-most).
  const layers = useMemo(
    () => (project ? [...project.layers].sort((a, b) => b.zIndex - a.zIndex) : []),
    [project]
  );

  if (!project) return null;

  const reorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const order = layers.map((layer) => layer.id);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const next = [...order];
    next.splice(from, 1);
    const targetIndex = next.indexOf(targetId);
    // Dragging downward drops after the target; upward drops before it.
    next.splice(from < to ? targetIndex + 1 : targetIndex, 0, draggedId);

    // The list is descending, REORDER_LAYER expects an ascending zIndex slot.
    const newIndex = next.length - 1 - next.indexOf(draggedId);
    dispatch({ type: 'REORDER_LAYER', payload: { id: draggedId, newIndex } });
  };

  const endDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const commitRename = (id: string, value: string) => {
    const name = value.trim();
    if (name) dispatch({ type: 'UPDATE_LAYER', payload: { id, changes: { name } } });
    dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: null } });
  };

  return (
    <aside className="ic-layer-list">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ic-accent">
          Layers
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-ic-elevated flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ic-muted">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-xs text-ic-muted mb-1">No layers yet</p>
            <p className="text-xs text-ic-muted/60">Add a shape or upload an image</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-ic-muted/40">
              <span className="kbd">L</span> add layer
            </span>
          </div>
        )}
        {layers.map((layer, idx) => {
          const previewUrl = layer.source.type === 'inline' && layer.source.data && layer.source.mimeType
            ? `data:${layer.source.mimeType};base64,${layer.source.data}`
            : null;

          return (
          <div
            key={layer.id}
            draggable={state.renamingLayerId !== layer.id}
            onDragStart={(e) => {
              setDraggingId(layer.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnter={() => setDragOverId(layer.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingId) reorder(draggingId, layer.id);
              endDrag();
            }}
            onDragEnd={endDrag}
            onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } })}
            onContextMenu={(e) => {
              e.preventDefault();
              dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
              setMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
            }}
            className={`ic-layer-row composer-layer-enter flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab transition ${
              draggingId === layer.id ? 'is-dragging' : ''
            } ${dragOverId === layer.id && draggingId && draggingId !== layer.id ? 'is-drag-over' : ''} ${
              state.activeLayerId === layer.id
                ? 'bg-ic-accent/20 border border-ic-accent/50'
                : 'hover:bg-ic-elevated border border-transparent'
            }`}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="w-8 h-8 rounded bg-ic-elevated flex items-center justify-center overflow-hidden text-xs">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                layer.source.shape?.kind === 'circle' ? '●' : layer.source.shape?.kind === 'rectangle' ? '■' : '◆'
              )}
            </div>
            {state.renamingLayerId === layer.id ? (
              <input
                type="text"
                defaultValue={layer.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => commitRename(layer.id, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(layer.id, e.currentTarget.value);
                  if (e.key === 'Escape') dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: null } });
                }}
                className="flex-1 min-w-0 text-xs px-1 py-0.5 rounded bg-ic-elevated border border-ic-accent focus:outline-none"
              />
            ) : (
              <span
                className="flex-1 text-xs truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: layer.id } });
                }}
                title="Double-click to rename"
              >
                {layer.name}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: layer.id } });
              }}
              className="p-1 text-ic-muted hover:text-ic-text"
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: { id: layer.id } });
              }}
              className="p-1 text-ic-muted hover:text-ic-text"
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
          );
        })}
      </div>

      <div
        className="mt-4 pt-4 border-t border-ic-border flex gap-2"
        style={{ visibility: state.activeLayerId ? 'visible' : 'hidden' }}
        aria-hidden={!state.activeLayerId}
      >
        <button
          type="button"
          disabled={!state.activeLayerId}
          onClick={() => state.activeLayerId && dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } })}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ic-elevated text-xs hover:bg-ic-border"
        >
          <Copy size={12} />
          Duplicate
        </button>
        <button
          type="button"
          disabled={!state.activeLayerId}
          onClick={() => state.activeLayerId && dispatch({ type: 'REMOVE_LAYER', payload: { id: state.activeLayerId } })}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ic-danger/20 text-ic-danger text-xs hover:bg-ic-danger/30"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>

      <QualityWarnings />

      {menu && (
        <LayerContextMenu x={menu.x} y={menu.y} layerId={menu.layerId} onClose={() => setMenu(null)} />
      )}
    </aside>
  );
};
