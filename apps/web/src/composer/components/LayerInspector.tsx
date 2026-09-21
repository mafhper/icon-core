import { useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import type { Fill, IconLayer, ShapeDefinition, ShapeKind } from '@iconcore/shared';
import { Button, InlineField, NumberField, Section, SegmentedControl, Select, Slider, Switch, TextField } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch, type ScopedLayerChanges } from '../utils/layerEdit';
import { fillColor, getShadow, setShadow } from '../utils/layerStyle';
import { FillEditor } from './FillEditor';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';

const blendModes: NonNullable<IconLayer['blendMode']>[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];
const shapeKinds: ShapeKind[] = ['circle', 'rectangle', 'rounded-rectangle', 'squircle', 'triangle', 'line', 'star'];

const BACKDROP_OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'plain', label: 'Plain' },
] as const;

/**
 * Editor for the image background (`project.canvas.background`). It is the same
 * property whether reached through the Background layer handle or (historically)
 * the empty-selection panel.
 */
const BackgroundFillSection = ({
  background,
  onChange,
  onCommit
}: {
  background: Fill;
  onChange: (fill: Fill, transient?: boolean) => void;
  onCommit: () => void;
}) => (
  <Section title="Background">
    <FillEditor
      label="Background fill"
      fill={background}
      onChange={onChange}
      onCommit={onCommit}
      noneNote="The exported image has a transparent background."
    />
  </Section>
);


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
        <p className="text-xs text-ic-muted text-center py-8">No project open.</p>
      </aside>
    );
  }

  if (baseLayer?.role === 'background') {
    const setCanvasBg = (next: Fill, transient = false) =>
      dispatch({ type: 'SET_CANVAS_BACKGROUND', payload: { background: next, transient } });
    return (
      <aside className="ic-inspector">
        <div className="ic-inspector-head">
          <div>
            <p>Image</p>
            <h2>Background</h2>
          </div>
        </div>
        <p className="ic-variant-scope-note">
          The <strong>Background</strong> layer is the handle of the exported image background. The editor backdrop is a separate setting (Work area).
        </p>
        <div className="ic-field-stack">
          <BackgroundFillSection
            background={state.project.canvas.background}
            onChange={setCanvasBg}
            onCommit={() => dispatch({ type: 'COMMIT_HISTORY' })}
          />
        </div>
      </aside>
    );
  }

  if (!layer || !baseLayer) {
    return (
      <aside className="ic-inspector">
        <div className="ic-inspector-head">
          <div>
            <p>Edit Space</p>
            <h2>Canvas</h2>
          </div>
        </div>
        <p className="ic-variant-scope-note">
          Select the <strong>Background</strong> layer to edit the image background — or another layer to edit it.
        </p>
        <div className="ic-field-stack">
          <Section
            title="Work area"
            hint="Editor backdrop around the icon — never exported, and distinct from the image background."
          >
            <SegmentedControl
              aria-label="Work area backdrop"
              options={BACKDROP_OPTIONS}
              value={state.editorBackdrop}
              onChange={(backdrop) => dispatch({ type: 'SET_EDITOR_BACKDROP', payload: backdrop })}
            />
          </Section>
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

  const shadow = getShadow(layer);
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
        <Section title="Layer">
          <TextField
            label="Name"
            value={baseLayer.name}
            onChange={(event) => dispatch({ type: 'UPDATE_LAYER', payload: { id: baseLayer.id, changes: { name: event.target.value } } })}
          />

          {layer.kind === 'text' && (
            <>
              <TextField
                label="Text"
                value={layer.text?.content ?? ''}
                onChange={(event) => updateLayer({ text: { ...layer.text, content: event.target.value } as IconLayer['text'] })}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField
                  label="Size"
                  min="8"
                  value={layer.text?.fontSize ?? 64}
                  onChange={(event) => updateLayer({ text: { ...layer.text, fontSize: Number(event.target.value) } as IconLayer['text'] })}
                />
                <NumberField
                  label="Weight"
                  min="100"
                  max="900"
                  step="100"
                  value={layer.text?.fontWeight ?? 700}
                  onChange={(event) => updateLayer({ text: { ...layer.text, fontWeight: Number(event.target.value) } as IconLayer['text'] })}
                />
              </div>
            </>
          )}
        </Section>

        <Section title="Composition">
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField
              label="X"
              value={Math.round(layer.transform.x)}
              onChange={(event) => updateTransform({ x: Number(event.target.value) }, false)}
            />
            <NumberField
              label="Y"
              value={Math.round(layer.transform.y)}
              onChange={(event) => updateTransform({ y: Number(event.target.value) }, false)}
            />
          </div>

          <Slider
            label={`Scale (${Math.round(layer.transform.scale * 100)}%)`}
            min="0.08"
            max="4"
            step="0.01"
            value={layer.transform.scale}
            onChange={(event) => updateTransform({ scale: Number(event.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />

          <Slider
            label={`Rotation (${Math.round(layer.transform.rotation)}°)`}
            min="-180"
            max="180"
            step="1"
            value={layer.transform.rotation}
            onChange={(event) => updateTransform({ rotation: Number(event.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </Section>

        {baseLayer.kind === 'shape' && shape && (
          <Section title="Geometry">
            <Select
              label="Shape"
              value={shape.kind}
              onChange={(event) => updateShape({ kind: event.target.value as ShapeKind })}
            >
              {shapeKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </Select>
            {shape.kind === 'rounded-rectangle' && (
              <Slider
                label={`Corner radius (${Math.round(shape.cornerRadius ?? 32)})`}
                min="0"
                max={Math.round(Math.min(shape.width, shape.height) / 2)}
                value={Math.round(shape.cornerRadius ?? 32)}
                onChange={(event) => updateShape({ cornerRadius: Number(event.target.value) }, true)}
                onPointerUp={commit}
                onKeyUp={commit}
              />
            )}
          </Section>
        )}

        <Section title="Color">
          <FillEditor
            label="Fill"
            fill={layer.fill ?? { kind: 'solid', color: fillColor(layer.fill) }}
            onChange={(next, transient) => updateLayer({ fill: next }, transient)}
            onCommit={commit}
          />

          <Slider
            variant="inline"
            label="Opacity"
            min="0"
            max="100"
            value={Math.round(layer.opacity * 100)}
            valueLabel={`${Math.round(layer.opacity * 100)}%`}
            onChange={(event) => updateLayer({ opacity: Number(event.target.value) / 100 })}
            onPointerUp={commit}
            onKeyUp={commit}
          />

          <InlineField label="Blend">
            <Select
              variant="inline"
              label="Blend mode"
              value={layer.blendMode ?? 'normal'}
              onChange={(event) => updateLayer({ blendMode: event.target.value as IconLayer['blendMode'] })}
            >
              {blendModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </Select>
          </InlineField>
        </Section>

        <Section title="Effects">
          <Switch
            label="Depth shadow"
            checked={shadow.enabled}
            onChange={(event) => updateLayer({ effects: setShadow(layer, { ...shadow, enabled: event.target.checked }) })}
          />

          <Slider
            label={`Shadow blur (${Number(shadow.params.blur ?? 34)})`}
            min="0"
            max="80"
            value={Number(shadow.params.blur ?? 34)}
            onChange={(event) => updateLayer({
              effects: setShadow(layer, { ...shadow, params: { ...shadow.params, blur: Number(event.target.value) } })
            }, true)}
            onPointerUp={commit}
          />

          <Slider
            label={`Layer blur (${blurRadius})`}
            min="0"
            max="60"
            value={blurRadius}
            onChange={(event) => setBlur(Number(event.target.value), true)}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </Section>

        {isImage && (
          <Section title="Image adjustments">
            <Slider
              label={`Hue (${imageFilter.hue ?? 0}°)`}
              min="-180"
              max="180"
              value={imageFilter.hue ?? 0}
              onChange={(event) => updateImageFilter({ hue: Number(event.target.value) }, true)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            <Slider
              label={`Saturation (${imageFilter.saturation ?? 100}%)`}
              min="0"
              max="200"
              value={imageFilter.saturation ?? 100}
              onChange={(event) => updateImageFilter({ saturation: Number(event.target.value) }, true)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            <Slider
              label={`Brightness (${imageFilter.brightness ?? 100}%)`}
              min="0"
              max="200"
              value={imageFilter.brightness ?? 100}
              onChange={(event) => updateImageFilter({ brightness: Number(event.target.value) }, true)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            <Slider
              label={`Contrast (${imageFilter.contrast ?? 100}%)`}
              min="0"
              max="200"
              value={imageFilter.contrast ?? 100}
              onChange={(event) => updateImageFilter({ contrast: Number(event.target.value) }, true)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            {baseLayer.source.type === 'inline' && baseLayer.source.mimeType !== 'image/svg+xml' && (
              <Button
                variant="secondary"
                iconLeft={<Eraser size={14} />}
                onClick={() => setShowBgRemoval(true)}
              >
                Remove background
              </Button>
            )}
          </Section>
        )}

        <Button
          variant="secondary"
          className="border-ic-danger/60 bg-ic-danger/10 text-ic-danger hover:bg-ic-danger/20"
          onClick={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}
        >
          Delete selected layer
        </Button>
      </div>

      {showBgRemoval && <BackgroundRemovalModal layer={baseLayer} onClose={() => setShowBgRemoval(false)} />}
    </aside>
  );
};
