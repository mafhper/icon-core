import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Copy } from 'lucide-react';
import { useComposer } from '../ComposerContext';

export const LayerList = () => {
  const { state, dispatch } = useComposer();

  if (!state.project) return null;

  const layers = [...state.project.layers].sort((a, b) => b.zIndex - a.zIndex);

  const handleAddLayer = () => {
    dispatch({
      type: 'ADD_LAYER',
      payload: { shape: { kind: 'circle', width: 100, height: 100 } }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      dispatch({ type: 'ADD_LAYER', payload: { file } });
    }
  };

  return (
    <aside className="w-[280px] border-r border-core-border bg-core-surface p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">
          Layers
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleAddLayer}
            className="p-1.5 rounded-lg hover:bg-core-elevated text-core-muted hover:text-core-text"
            title="Add shape layer"
          >
            <Plus size={16} />
          </button>
          <label className="p-1.5 rounded-lg hover:bg-core-elevated text-core-muted hover:text-core-text cursor-pointer" title="Upload image">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-core-elevated flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-core-muted">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-xs text-core-muted mb-1">No layers yet</p>
            <p className="text-xs text-core-muted/60">Add a shape or upload an image</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-core-muted/40">
              <span className="kbd">L</span> add layer
            </span>
          </div>
        )}
        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } })}
            className={`composer-layer-enter flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
              state.activeLayerId === layer.id
                ? 'bg-core-accent/20 border border-core-accent/50'
                : 'hover:bg-core-elevated border border-transparent'
            }`}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="w-8 h-8 rounded bg-core-elevated flex items-center justify-center text-xs">
              {layer.source.shape?.kind === 'circle' ? '●' : layer.source.shape?.kind === 'rectangle' ? '■' : '◆'}
            </div>
            <span className="flex-1 text-xs truncate">{layer.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: layer.id } });
              }}
              className="p-1 text-core-muted hover:text-core-text"
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: { id: layer.id } });
              }}
              className="p-1 text-core-muted hover:text-core-text"
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        ))}
      </div>

      {state.activeLayerId && (
        <div className="mt-4 pt-4 border-t border-core-border flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId! } })}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-core-elevated text-xs hover:bg-core-border"
          >
            <Copy size={12} />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: state.activeLayerId! } })}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-core-danger/20 text-core-danger text-xs hover:bg-core-danger/30"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </aside>
  );
};