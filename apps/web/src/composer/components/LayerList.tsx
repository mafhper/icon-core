import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, ChevronRight } from 'lucide-react';
import type { IconLayer } from '@iconcore/shared';
import { withIconStroke } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { QualityWarnings } from './QualityWarnings';
import { LayerContextMenu } from './LayerContextMenu';
import { groupLayers } from '../utils/layerGroups';

/** Drag-and-drop and rename both need the flat, display-ordered list. */
export const LayerList = () => {
  const { state, dispatch } = useComposer();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const project = state.project;
  // Displayed top-to-bottom in descending zIndex (top of the list = front-most).
  const layers = useMemo(
    () => (project ? [...project.layers].sort((a, b) => b.zIndex - a.zIndex) : []),
    [project]
  );
  // Presentation only: `IconLayer.kind` already carries everything the groups
  // need, so grouping is a view concern and never touches the document.
  const groups = useMemo(() => groupLayers(layers), [layers]);

  if (!project) return null;

  const endDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  /**
   * Arrastar uma camada para outra posicao.
   *
   * ## A conta e no frame **ascendente**, e precisa ser
   *
   * A lista na tela e descendente (frente em cima) e o array do reducer e ascendente
   * (`zIndex` crescendo). Sao o mesmo conjunto em ordem inversa, com o handle de Background
   * em posicoes opostas: no fim da lista, no inicio do array.
   *
   * A versao anterior fazia a conta na lista e refletia no fim
   * (`next.length - 1 - next.indexOf(...)`). Sem o handle de Background os dois frames tem
   * o mesmo tamanho e a reflexao acerta por acaso; **com** o handle, os espacos de indices
   * nao coincidem e o arrasto para baixo errava um degrau.
   *
   * E o `newIndex` e uma posicao no array **depois** da remocao — e o que `splice` faz.
   */
  const reorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const asc = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    const from = asc.findIndex((layer) => layer.id === draggedId);
    const to = asc.findIndex((layer) => layer.id === targetId);
    if (from === -1 || to === -1) return;

    const next = asc.map((layer) => layer.id);
    next.splice(from, 1);
    // Dragging down the screen list = later in the ascending array = drops after the target.
    next.splice(from < to ? to + 1 : to, 0, draggedId);

    dispatch({ type: 'REORDER_LAYER', payload: { id: draggedId, newIndex: next.indexOf(draggedId) } });
  };

  const commitRename = (id: string, value: string) => {
    const name = value.trim();
    if (name) dispatch({ type: 'UPDATE_LAYER', payload: { id, changes: { name } } });
    dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: null } });
  };

  const openMenu = (e: React.MouseEvent, layer: IconLayer) => {
    e.preventDefault();
    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
    setMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
  };

  return (
    <aside className="ic-layer-list">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
          Layers
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-ic-elevated flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ic-text-muted">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-xs text-ic-text-muted mb-1">No layers yet</p>
            <p className="text-xs text-ic-text-muted/60">Add a shape or upload an image</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-ic-text-muted/40">
              <span className="kbd">L</span> add layer
            </span>
          </div>
        )}

        {groups.map((group) => {
          const isCollapsed = collapsed[group.id] === true;
          return (
            <section key={group.id} aria-label={group.label}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [group.id]: !(prev[group.id] === true) }))
                }
                aria-expanded={!isCollapsed}
                className="w-full flex items-center gap-1.5 px-1 py-1 mb-1 rounded text-left text-[0.7rem] font-semibold uppercase tracking-wide text-ic-text-muted hover:text-ic-text"
              >
                <ChevronRight
                  size={12}
                  className={`shrink-0 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                />
                {group.label}
                <span className="ml-auto text-[0.68rem] font-normal normal-case tracking-normal text-ic-text-faint tabular-nums">
                  {group.layers.length}
                </span>
              </button>

              {isCollapsed ? (
                <p className="px-3 pb-1 text-[0.7rem] text-ic-text-faint">{group.hint}</p>
              ) : (
                <div className="space-y-1">
                  {group.layers.map((layer, idx) => (
                    <LayerRow
                      key={layer.id}
                      layer={layer}
                      index={idx}
                      active={state.activeLayerId === layer.id}
                      renaming={state.renamingLayerId === layer.id}
                      dragging={draggingId === layer.id}
                      dragOver={dragOverId === layer.id && draggingId !== null && draggingId !== layer.id}
                      onSelect={() => dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } })}
                      onContextMenu={(e) => openMenu(e, layer)}
                      onToggleVisibility={() =>
                        dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: layer.id } })
                      }
                      onToggleLock={() =>
                        dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: { id: layer.id } })
                      }
                      onDuplicate={() =>
                        dispatch({ type: 'DUPLICATE_LAYER', payload: { id: layer.id } })
                      }
                      onRemove={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}
                      onRename={(value) => commitRename(layer.id, value)}
                      onBeginRename={() =>
                        dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: layer.id } })
                      }
                      onDragStart={() => setDraggingId(layer.id)}
                      onDragEnter={() => setDragOverId(layer.id)}
                      onDrop={() => {
                        if (draggingId) reorder(draggingId, layer.id);
                        endDrag();
                      }}
                      onDragEnd={endDrag}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <QualityWarnings />

      {menu && (
        <LayerContextMenu x={menu.x} y={menu.y} layerId={menu.layerId} onClose={() => setMenu(null)} />
      )}
    </aside>
  );
};

interface LayerRowProps {
  layer: IconLayer;
  /** Position within its group, so the entrance stagger stays local. */
  index: number;
  active: boolean;
  renaming: boolean;
  dragging: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRename: (value: string) => void;
  onBeginRename: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

/** One layer row. Split out so the group headers do not have to share a map. */
const LayerRow = ({
  layer,
  index,
  active,
  renaming,
  dragging,
  dragOver,
  onSelect,
  onContextMenu,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onRemove,
  onRename,
  onBeginRename,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd
}: LayerRowProps) => {
  const previewUrl =
    layer.source.type === 'inline' && layer.source.data && layer.source.mimeType
      ? `data:${layer.source.mimeType};base64,${layer.source.data}`
      : null;

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`ic-layer-row composer-layer-enter flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab transition ${
        dragging ? 'is-dragging' : ''
      } ${dragOver ? 'is-drag-over' : ''} ${
        active
          ? 'bg-ic-accent/20 border border-ic-accent/50'
          : 'hover:bg-ic-elevated border border-transparent'
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        aria-hidden="true"
        className="w-8 h-8 rounded bg-ic-elevated flex items-center justify-center overflow-hidden text-xs"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-contain" />
        ) : layer.source.shape?.kind === 'circle' ? (
          '●'
        ) : layer.source.shape?.kind === 'rectangle' ? (
          '■'
        ) : (
          '◆'
        )}
      </div>

      {renaming ? (
        <input
          type="text"
          defaultValue={layer.name}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') onRename(layer.name);
          }}
          className="flex-1 min-w-0 bg-ic-bg border border-ic-accent/50 rounded px-1.5 py-0.5 text-xs text-ic-text"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onBeginRename();
          }}
          className="flex-1 min-w-0 truncate text-left text-xs text-ic-text border-0 bg-transparent cursor-text"
          title="Double-click to rename"
        >
          {layer.name}
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        title={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        className="p-1 text-ic-text-muted hover:text-ic-text"
      >
        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        title={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        className="p-1 text-ic-text-muted hover:text-ic-text"
      >
        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        aria-label={`Duplicate ${layer.name}`}
        title="Duplicate layer"
        className="p-1 text-ic-text-muted hover:text-ic-text"
      >
        {withIconStroke(<Copy size={12} />)}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Delete ${layer.name}`}
        title="Delete layer"
        className="p-1 text-ic-text-muted hover:text-ic-danger"
      >
        {withIconStroke(<Trash2 size={12} />)}
      </button>
    </div>
  );
};