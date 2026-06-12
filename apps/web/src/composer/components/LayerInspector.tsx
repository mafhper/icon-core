import { useComposer } from '../ComposerContext';
import type { IconLayer } from '@iconcore/shared';

export const LayerInspector = () => {
  const { state, dispatch } = useComposer();

  if (!state.project || !state.activeLayerId) {
    return (
      <aside className="w-[280px] border-l border-core-border bg-core-surface p-4">
        <p className="text-xs text-core-muted text-center py-8">
          Select a layer to edit its properties.
        </p>
      </aside>
    );
  }

  const layer = state.project.layers.find(l => l.id === state.activeLayerId);
  if (!layer) return null;

  const updateLayer = (changes: Partial<IconLayer>) => {
    dispatch({ type: 'UPDATE_LAYER', payload: { id: layer.id, changes } });
  };

  return (
    <aside className="w-[280px] border-l border-core-border bg-core-surface p-4 overflow-y-auto">
      <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent mb-4">
        Layer Properties
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
            Name
          </label>
          <input
            type="text"
            value={layer.name}
            onChange={(e) => updateLayer({ name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-core-border bg-core-elevated text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
            Transform
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-core-muted mb-1">X</label>
              <input
                type="number"
                value={layer.transform.x}
                onChange={(e) => updateLayer({ transform: { ...layer.transform, x: Number(e.target.value) } })}
                className="w-full px-2 py-1.5 rounded border border-core-border bg-core-elevated text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-core-muted mb-1">Y</label>
              <input
                type="number"
                value={layer.transform.y}
                onChange={(e) => updateLayer({ transform: { ...layer.transform, y: Number(e.target.value) } })}
                className="w-full px-2 py-1.5 rounded border border-core-border bg-core-elevated text-xs"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-[10px] text-core-muted mb-1">
              Scale ({(layer.transform.scale * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.01"
              value={layer.transform.scale}
              onChange={(e) => updateLayer({ transform: { ...layer.transform, scale: Number(e.target.value) } })}
              className="w-full"
            />
          </div>
          <div className="mt-2">
            <label className="block text-[10px] text-core-muted mb-1">
              Rotation ({layer.transform.rotation}°)
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={layer.transform.rotation}
              onChange={(e) => updateLayer({ transform: { ...layer.transform, rotation: Number(e.target.value) } })}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
            Fill
          </label>
          <input
            type="color"
            value={layer.fill?.kind === 'solid' ? layer.fill.color : '#ffffff'}
            onChange={(e) => updateLayer({ fill: { kind: 'solid', color: e.target.value } })}
            className="w-full h-10 rounded border border-core-border bg-core-elevated cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
            Opacity ({(layer.opacity * 100).toFixed(0)}%)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.opacity}
            onChange={(e) => updateLayer({ opacity: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
            Blend Mode
          </label>
          <select
            value={layer.blendMode ?? 'normal'}
            onChange={(e) => updateLayer({ blendMode: e.target.value as any })}
            className="w-full px-3 py-2 rounded-lg border border-core-border bg-core-elevated text-xs"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
          </select>
        </div>
      </div>
    </aside>
  );
};