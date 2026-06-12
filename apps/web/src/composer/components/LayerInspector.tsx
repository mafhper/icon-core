import { useMemo, useState } from 'react';
import type { IconLayer, LayerEffect, Fill } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';

const blendModes: NonNullable<IconLayer['blendMode']>[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];

const getShadow = (layer: IconLayer): LayerEffect => (
  layer.effects?.find((effect) => effect.kind === 'depth-shadow') ?? {
    kind: 'depth-shadow',
    enabled: false,
    params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' }
  }
);

const setShadow = (layer: IconLayer, shadow: LayerEffect): LayerEffect[] => {
  const effects = layer.effects ?? [];
  const exists = effects.some((effect) => effect.kind === 'depth-shadow');
  return exists
    ? effects.map((effect) => effect.kind === 'depth-shadow' ? shadow : effect)
    : [...effects, shadow];
};

const fillColor = (fill?: Fill) => fill?.kind === 'solid' ? fill.color ?? '#111827' : '#111827';

export const LayerInspector = () => {
  const { state, dispatch } = useComposer();
  const [variantOnly, setVariantOnly] = useState(false);

  const baseLayer = state.project?.layers.find((layer) => layer.id === state.activeLayerId);
  const variantOverride = baseLayer?.variantOverrides?.[state.activeVariant];
  const layer = useMemo<IconLayer | null>(() => {
    if (!baseLayer) return null;
    if (!variantOverride) return baseLayer;
    return {
      ...baseLayer,
      ...variantOverride,
      source: variantOverride.source ? { ...baseLayer.source, ...variantOverride.source } : baseLayer.source,
      transform: variantOverride.transform ? { ...baseLayer.transform, ...variantOverride.transform } : baseLayer.transform,
      text: variantOverride.text ? { ...baseLayer.text, ...variantOverride.text } as IconLayer['text'] : baseLayer.text,
      effects: variantOverride.effects ?? baseLayer.effects
    };
  }, [baseLayer, variantOverride]);

  if (!state.project || !layer || !baseLayer) {
    return (
      <aside className="ic-inspector">
        <p className="text-xs text-core-muted text-center py-8">
          Select a layer to edit its properties.
        </p>
      </aside>
    );
  }

  const commit = () => dispatch({ type: 'COMMIT_HISTORY' });

  const updateLayer = (changes: Partial<IconLayer>, transient = false) => {
    if (variantOnly && state.activeVariant !== 'default') {
      dispatch({
        type: 'UPDATE_LAYER_VARIANT',
        payload: { id: layer.id, variant: state.activeVariant, changes, transient }
      });
      return;
    }
    dispatch({ type: 'UPDATE_LAYER', payload: { id: layer.id, changes, transient } });
  };

  const updateTransform = (changes: Partial<IconLayer['transform']>, transient = true) => {
    updateLayer({ transform: { ...layer.transform, ...changes } }, transient);
  };

  const shadow = getShadow(layer);
  const solidColor = fillColor(layer.fill);

  return (
    <aside className="ic-inspector">
      <div className="ic-inspector-head">
        <div>
          <p>Edit Space</p>
          <h2>Layer Properties</h2>
        </div>
        <span>{state.activeVariant}</span>
      </div>

      <label className="ic-switch-row">
        <span>Variant override only</span>
        <input
          type="checkbox"
          checked={variantOnly && state.activeVariant !== 'default'}
          disabled={state.activeVariant === 'default'}
          onChange={(event) => setVariantOnly(event.target.checked)}
        />
      </label>

      <div className="ic-field-stack">
        <label className="ic-field">
          <span>Name</span>
          <input value={baseLayer.name} onChange={(event) => updateLayer({ name: event.target.value })} />
        </label>

        {layer.kind === 'text' && (
          <>
            <label className="ic-field">
              <span>Text</span>
              <input
                value={layer.text?.content ?? ''}
                onChange={(event) => updateLayer({ text: { ...layer.text, content: event.target.value } as IconLayer['text'] })}
              />
            </label>
            <div className="ic-field-grid">
              <label className="ic-field">
                <span>Size</span>
                <input
                  type="number"
                  min="8"
                  value={layer.text?.fontSize ?? 64}
                  onChange={(event) => updateLayer({ text: { ...layer.text, fontSize: Number(event.target.value) } as IconLayer['text'] })}
                />
              </label>
              <label className="ic-field">
                <span>Weight</span>
                <input
                  type="number"
                  min="100"
                  max="900"
                  step="100"
                  value={layer.text?.fontWeight ?? 700}
                  onChange={(event) => updateLayer({ text: { ...layer.text, fontWeight: Number(event.target.value) } as IconLayer['text'] })}
                />
              </label>
            </div>
          </>
        )}

        <div className="ic-field-grid">
          <label className="ic-field">
            <span>X</span>
            <input type="number" value={Math.round(layer.transform.x)} onChange={(event) => updateTransform({ x: Number(event.target.value) }, false)} />
          </label>
          <label className="ic-field">
            <span>Y</span>
            <input type="number" value={Math.round(layer.transform.y)} onChange={(event) => updateTransform({ y: Number(event.target.value) }, false)} />
          </label>
        </div>

        <label className="ic-field">
          <span>Scale ({Math.round(layer.transform.scale * 100)}%)</span>
          <input
            type="range"
            min="0.08"
            max="4"
            step="0.01"
            value={layer.transform.scale}
            onChange={(event) => updateTransform({ scale: Number(event.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </label>

        <label className="ic-field">
          <span>Rotation ({Math.round(layer.transform.rotation)}°)</span>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={layer.transform.rotation}
            onChange={(event) => updateTransform({ rotation: Number(event.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </label>

        <div className="ic-field-grid">
          <label className="ic-field">
            <span>Fill</span>
            <input
              type="color"
              value={solidColor}
              onChange={(event) => updateLayer({ fill: { kind: 'solid', color: event.target.value } })}
            />
          </label>
          <label className="ic-field">
            <span>Opacity</span>
            <input
              type="number"
              min="0"
              max="100"
              value={Math.round(layer.opacity * 100)}
              onChange={(event) => updateLayer({ opacity: Number(event.target.value) / 100 })}
            />
          </label>
        </div>

        <label className="ic-field">
          <span>Gradient preset</span>
          <select
            value={layer.fill?.kind === 'linear-gradient' ? 'gold-cyan' : 'solid'}
            onChange={(event) => {
              if (event.target.value === 'solid') {
                updateLayer({ fill: { kind: 'solid', color: solidColor } });
                return;
              }
              updateLayer({
                fill: {
                  kind: 'linear-gradient',
                  angle: 135,
                  stops: [
                    { offset: 0, color: '#f3d18a' },
                    { offset: 1, color: '#6bb7d8' }
                  ]
                }
              });
            }}
          >
            <option value="solid">Solid color</option>
            <option value="gold-cyan">Gold / cyan glass</option>
          </select>
        </label>

        <label className="ic-field">
          <span>Blend mode</span>
          <select
            value={layer.blendMode ?? 'normal'}
            onChange={(event) => updateLayer({ blendMode: event.target.value as IconLayer['blendMode'] })}
          >
            {blendModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </label>

        <label className="ic-switch-row">
          <span>Depth shadow</span>
          <input
            type="checkbox"
            checked={shadow.enabled}
            onChange={(event) => updateLayer({ effects: setShadow(layer, { ...shadow, enabled: event.target.checked }) })}
          />
        </label>

        <label className="ic-field">
          <span>Shadow blur ({Number(shadow.params.blur ?? 34)})</span>
          <input
            type="range"
            min="0"
            max="80"
            value={Number(shadow.params.blur ?? 34)}
            onChange={(event) => updateLayer({
              effects: setShadow(layer, { ...shadow, params: { ...shadow.params, blur: Number(event.target.value) } })
            }, true)}
            onPointerUp={commit}
          />
        </label>

        <button
          type="button"
          className="ic-danger-button"
          onClick={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}
        >
          Delete selected layer
        </button>
      </div>
    </aside>
  );
};
