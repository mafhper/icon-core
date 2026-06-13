import { useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import type { Fill, IconLayer, ShapeDefinition, ShapeKind } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { brandGradientFill } from '../constants';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch, type ScopedLayerChanges } from '../utils/layerEdit';
import { fillColor, getShadow, setShadow } from '../utils/layerStyle';
import { GradientEditor } from './GradientEditor';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';

const blendModes: NonNullable<IconLayer['blendMode']>[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];
const shapeKinds: ShapeKind[] = ['circle', 'rectangle', 'rounded-rectangle', 'squircle', 'triangle', 'line', 'star'];

export const LayerInspector = () => {
  const { state, dispatch } = useComposer();
  const [showBgRemoval, setShowBgRemoval] = useState(false);

  const baseLayer = state.project?.layers.find((layer) => layer.id === state.activeLayerId);
  const activeVariant = state.activeVariant;
  const layer = useMemo<IconLayer | null>(
    () => (baseLayer ? resolveLayerVariant(baseLayer, activeVariant) : null),
    [baseLayer, activeVariant]
  );

  if (!state.project) {
    return (
      <aside className="ic-inspector">
        <p className="text-xs text-core-muted text-center py-8">No project open.</p>
      </aside>
    );
  }

  if (!layer || !baseLayer) {
    const bg = state.project.canvas.background;
    const bgSolid = bg.kind === 'solid' ? bg.color ?? '#ffffff' : '#ffffff';
    const setCanvasBg = (background: Fill, transient = false) =>
      dispatch({ type: 'SET_CANVAS_BACKGROUND', payload: { background, transient } });
    return (
      <aside className="ic-inspector">
        <div className="ic-inspector-head">
          <div>
            <p>Edit Space</p>
            <h2>Canvas</h2>
          </div>
        </div>
        <p className="ic-variant-scope-note">No layer selected — editing the <strong>canvas background</strong>.</p>
        <div className="ic-field-stack">
          <label className="ic-field">
            <span>Background color</span>
            <input type="color" value={bgSolid} onChange={(event) => setCanvasBg({ kind: 'solid', color: event.target.value })} />
          </label>
          <label className="ic-field">
            <span>Fill type</span>
            <select
              value={bg.kind}
              onChange={(event) => {
                const kind = event.target.value as Fill['kind'];
                if (kind === 'solid') { setCanvasBg({ kind: 'solid', color: bgSolid }); return; }
                const preset = brandGradientFill();
                setCanvasBg({ ...preset, kind, stops: bg.stops && bg.stops.length >= 2 ? bg.stops : preset.stops });
              }}
            >
              <option value="solid">Solid color</option>
              <option value="linear-gradient">Linear gradient</option>
              <option value="radial-gradient">Radial gradient</option>
            </select>
          </label>
          {bg.kind !== 'solid' && (
            <GradientEditor
              fill={bg}
              onChange={(next) => setCanvasBg(next, true)}
              onCommit={() => dispatch({ type: 'COMMIT_HISTORY' })}
            />
          )}
        </div>
      </aside>
    );
  }

  const scoped = activeVariant !== 'default';
  const commit = () => dispatch({ type: 'COMMIT_HISTORY' });

  // Appearance edits auto-scope to the active variant; identity (name) stays on the base layer.
  const updateLayer = (changes: ScopedLayerChanges, transient = false) => {
    scopedLayerDispatch(dispatch, activeVariant, layer.id, changes, { transient });
  };

  const updateTransform = (changes: Partial<IconLayer['transform']>, transient = true) => {
    updateLayer({ transform: { ...layer.transform, ...changes } }, transient);
  };

  // Shape geometry is structural → always written to the base layer (like name).
  const shape = baseLayer.source.shape;
  const updateShape = (patch: Partial<ShapeDefinition>, transient = false) => {
    if (!shape) return;
    dispatch({
      type: 'UPDATE_LAYER',
      payload: { id: baseLayer.id, changes: { source: { ...baseLayer.source, shape: { ...shape, ...patch } } }, transient }
    });
  };

  const setFillKind = (kind: Fill['kind']) => {
    if (kind === 'solid') {
      updateLayer({ fill: { kind: 'solid', color: solidColor } });
      return;
    }
    const preset = brandGradientFill();
    const stops = layer.fill?.stops && layer.fill.stops.length >= 2 ? layer.fill.stops : preset.stops;
    updateLayer({ fill: { ...preset, kind, stops, angle: layer.fill?.angle ?? preset.angle } });
  };

  const shadow = getShadow(layer);
  const solidColor = fillColor(layer.fill);
  const isImage = baseLayer.kind === 'image' || baseLayer.kind === 'svg';
  const imageFilter = layer.imageFilter ?? {};
  const updateImageFilter = (patch: Partial<typeof imageFilter>, transient = false) =>
    updateLayer({ imageFilter: { ...imageFilter, ...patch } }, transient);

  const blurRadius = Number(layer.effects?.find((effect) => effect.kind === 'surface-blur')?.params.radius ?? 0);
  const setBlur = (radius: number, transient = false) => {
    const effects = layer.effects ?? [];
    const next = radius <= 0
      ? effects.filter((effect) => effect.kind !== 'surface-blur')
      : effects.some((effect) => effect.kind === 'surface-blur')
        ? effects.map((effect) => (effect.kind === 'surface-blur' ? { ...effect, enabled: true, params: { radius } } : effect))
        : [...effects, { kind: 'surface-blur' as const, enabled: true, params: { radius } }];
    updateLayer({ effects: next }, transient);
  };

  return (
    <aside className="ic-inspector">
      <div className="ic-inspector-head">
        <div>
          <p>Edit Space</p>
          <h2>Layer Properties</h2>
        </div>
        <span>{activeVariant}</span>
      </div>

      {scoped && (
        <p className="ic-variant-scope-note">
          Editing the <strong>{activeVariant}</strong> variant — changes stay here, not the default.
        </p>
      )}

      <div className="ic-field-stack">
        <h3 className="ic-section-head">Layer</h3>
        <label className="ic-field">
          <span>Name</span>
          <input
            value={baseLayer.name}
            onChange={(event) => dispatch({ type: 'UPDATE_LAYER', payload: { id: baseLayer.id, changes: { name: event.target.value } } })}
          />
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

        <h3 className="ic-section-head">Composition</h3>
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

        {baseLayer.kind === 'shape' && shape && (
          <>
            <h3 className="ic-section-head">Geometry</h3>
            <label className="ic-field">
              <span>Shape</span>
              <select value={shape.kind} onChange={(event) => updateShape({ kind: event.target.value as ShapeKind })}>
                {shapeKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </label>
            {shape.kind === 'rounded-rectangle' && (
              <label className="ic-field">
                <span>Corner radius ({Math.round(shape.cornerRadius ?? 32)})</span>
                <input
                  type="range"
                  min="0"
                  max={Math.round(Math.min(shape.width, shape.height) / 2)}
                  value={Math.round(shape.cornerRadius ?? 32)}
                  onChange={(event) => updateShape({ cornerRadius: Number(event.target.value) }, true)}
                  onPointerUp={commit}
                  onKeyUp={commit}
                />
              </label>
            )}
          </>
        )}

        <h3 className="ic-section-head">Color</h3>
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
          <span>Fill type</span>
          <select
            value={layer.fill?.kind ?? 'solid'}
            onChange={(event) => setFillKind(event.target.value as Fill['kind'])}
          >
            <option value="solid">Solid color</option>
            <option value="linear-gradient">Linear gradient</option>
            <option value="radial-gradient">Radial gradient</option>
          </select>
        </label>

        {layer.fill && layer.fill.kind !== 'solid' && (
          <GradientEditor
            fill={layer.fill}
            onChange={(next) => updateLayer({ fill: next }, true)}
            onCommit={commit}
          />
        )}

        <label className="ic-field">
          <span>Blend mode</span>
          <select
            value={layer.blendMode ?? 'normal'}
            onChange={(event) => updateLayer({ blendMode: event.target.value as IconLayer['blendMode'] })}
          >
            {blendModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </label>

        <h3 className="ic-section-head">Effects</h3>
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

        <label className="ic-field">
          <span>Layer blur ({blurRadius})</span>
          <input
            type="range"
            min="0"
            max="60"
            value={blurRadius}
            onChange={(event) => setBlur(Number(event.target.value), true)}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </label>

        {isImage && (
          <div className="ic-field-stack ic-image-filters">
            <span className="ic-section-label">Image adjustments</span>
            <label className="ic-field">
              <span>Hue ({imageFilter.hue ?? 0}°)</span>
              <input type="range" min="-180" max="180" value={imageFilter.hue ?? 0}
                onChange={(event) => updateImageFilter({ hue: Number(event.target.value) }, true)} onPointerUp={commit} onKeyUp={commit} />
            </label>
            <label className="ic-field">
              <span>Saturation ({imageFilter.saturation ?? 100}%)</span>
              <input type="range" min="0" max="200" value={imageFilter.saturation ?? 100}
                onChange={(event) => updateImageFilter({ saturation: Number(event.target.value) }, true)} onPointerUp={commit} onKeyUp={commit} />
            </label>
            <label className="ic-field">
              <span>Brightness ({imageFilter.brightness ?? 100}%)</span>
              <input type="range" min="0" max="200" value={imageFilter.brightness ?? 100}
                onChange={(event) => updateImageFilter({ brightness: Number(event.target.value) }, true)} onPointerUp={commit} onKeyUp={commit} />
            </label>
            <label className="ic-field">
              <span>Contrast ({imageFilter.contrast ?? 100}%)</span>
              <input type="range" min="0" max="200" value={imageFilter.contrast ?? 100}
                onChange={(event) => updateImageFilter({ contrast: Number(event.target.value) }, true)} onPointerUp={commit} onKeyUp={commit} />
            </label>
            {baseLayer.source.type === 'inline' && baseLayer.source.mimeType !== 'image/svg+xml' && (
              <button type="button" className="ic-button inline-flex items-center justify-center gap-2" onClick={() => setShowBgRemoval(true)}>
                <Eraser size={14} />
                Remove background
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="ic-danger-button"
          onClick={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}
        >
          Delete selected layer
        </button>
      </div>

      {showBgRemoval && <BackgroundRemovalModal layer={baseLayer} onClose={() => setShowBgRemoval(false)} />}
    </aside>
  );
};
