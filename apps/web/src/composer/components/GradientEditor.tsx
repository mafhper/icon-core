import { useRef, useState } from 'react';
import { AlignHorizontalDistributeCenter, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { GradientFill, GradientStop } from '@iconcore/shared';
import { Button, ColorField, IconButton, NumberField, Slider, type ColorValue } from '@iconcore/ui';
import { normalizeStops, sampleStopDetailed, sampleStops } from '@iconcore/renderer';
import { applyGradientPreset, presetsFor } from '../utils/gradientPresets';

interface GradientEditorProps {
  fill: GradientFill;
  /** Transient update (no history commit). */
  onChange: (fill: GradientFill, transient?: boolean) => void;
  /** Commit the current value to history. */
  onCommit: () => void;
}

const STOP_SAMPLES = 20;

const barCss = (stops: GradientStop[]): string => {
  const samples = Array.from({ length: STOP_SAMPLES + 1 }, (_, i) => i / STOP_SAMPLES);
  return `linear-gradient(90deg, ${samples
    .map((t) => `${sampleStops(stops, t)} ${Math.round(t * 100)}%`)
    .join(', ')})`;
};

const toColorValue = (stop: GradientStop): ColorValue => ({
  color: stop.color,
  alpha: stop.alpha ?? 1
});

const pct = (value: number): string => `${Math.round(value * 100)}%`;

export const GradientEditor = ({ fill, onChange, onCommit }: GradientEditorProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // While a stop is dragged the list must NOT be re-sorted: the array is sorted by
  // offset, so crossing a neighbour would make the index under the pointer refer to
  // a different stop. The order is restored (sorted) on commit.
  const stops =
    dragging !== null && fill.stops && fill.stops.length >= 2 ? fill.stops : normalizeStops(fill.stops);

  const setStops = (next: GradientStop[], transient = false) => {
    onChange({ ...fill, stops: next }, transient);
  };

  const updateStop = (index: number, patch: Partial<GradientStop>, transient = false) => {
    setStops(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)), transient);
  };

  const addStop = () => {
    const gaps = stops.slice(0, -1).map((stop, i) => ({ index: i, size: stops[i + 1].offset - stop.offset }));
    const widest = gaps.sort((a, b) => b.size - a.size)[0];
    const left = stops[widest?.index ?? 0];
    const right = stops[(widest?.index ?? 0) + 1] ?? left;
    const offset = (left.offset + right.offset) / 2;
    const { color, alpha } = sampleStopDetailed(stops, offset);
    setStops([...stops, { offset, color, alpha }].sort((a, b) => a.offset - b.offset));
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  const reverse = () => {
    setStops([...stops].reverse().map((stop) => ({ ...stop, offset: 1 - stop.offset })));
  };

  const distribute = () => {
    const last = stops.length - 1 || 1;
    setStops(stops.map((stop, i) => ({ ...stop, offset: Number((i / last).toFixed(3)) })));
  };

  const offsetFromClientX = (clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const isLinear = fill.kind === 'linear-gradient';
  const isAngular = fill.kind === 'angular-gradient';
  const isRadial = fill.kind === 'radial-gradient';
  const isDiamond = fill.kind === 'diamond-gradient';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div
        ref={barRef}
        className="relative mx-2 h-6 cursor-pointer rounded-ic-sm border border-ic-border"
        style={{ background: barCss(stops) }}
        onPointerDown={(event) => {
          // The bar advertises `cursor-pointer`: clicking it adds a stop there and
          // starts dragging it. Handles have their own pointerdown.
          if ((event.target as HTMLElement).closest('.ic-gradient-handle')) return;
          const offset = Number(offsetFromClientX(event.clientX).toFixed(3));
          const { color, alpha } = sampleStopDetailed(stops, offset);
          const next = [...stops, { offset, color, alpha }].sort((a, b) => a.offset - b.offset);
          setStops(next);
          setDragging(next.findIndex((stop) => stop.offset === offset && stop.color === color));
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging === null) return;
          updateStop(dragging, { offset: Number(offsetFromClientX(event.clientX).toFixed(3)) }, true);
        }}
        onPointerUp={() => {
          if (dragging !== null) {
            setDragging(null);
            // Commit with the canonical order so the stored list stays sorted.
            setStops(normalizeStops(stops), true);
            onCommit();
          }
        }}
      >
        {stops.map((stop, index) => (
          <div
            key={index}
            role="slider"
            tabIndex={0}
            aria-label={`Stop ${index + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(stop.offset * 100)}
            aria-valuetext={pct(stop.offset)}
            onPointerDown={(event) => {
              setDragging(index);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.1 : 0.01;
              if (event.key === 'ArrowLeft') updateStop(index, { offset: Math.max(0, stop.offset - step) }, true);
              else if (event.key === 'ArrowRight') updateStop(index, { offset: Math.min(1, stop.offset + step) }, true);
              else if (event.key === 'Home') updateStop(index, { offset: 0 }, true);
              else if (event.key === 'End') updateStop(index, { offset: 1 }, true);
              else if ((event.key === 'Delete' || event.key === 'Backspace') && stops.length > 2) removeStop(index);
              else return;
              event.preventDefault();
              onCommit();
            }}
            className="ic-gradient-handle"
            style={{ left: pct(stop.offset), background: stop.color }}
          />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <span className="text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">Presets</span>
        <div className="ic-gradient-presets">
          {presetsFor(fill).map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="ic-gradient-preset"
              style={{ background: barCss(preset.stops) }}
              title={`${preset.name} — ${preset.hint}`}
              aria-label={`Apply ${preset.name} gradient`}
              onClick={() => onChange(applyGradientPreset(fill, preset))}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
            Stops {stops.length > 2 ? `(${stops.length})` : ''}
          </span>
          <Button
            variant="ghost"
            iconLeft={<Plus size={12} />}
            title="Add a stop at the widest gap"
            onClick={addStop}
          >
            Add stop
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {stops.map((stop, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <NumberField
                variant="inline"
                unit="%"
                label={`Stop ${index + 1} position`}
                min="0"
                max="100"
                value={Math.round(stop.offset * 100)}
                onChange={(event) => updateStop(index, { offset: Number(event.target.value) / 100 }, true)}
                onBlur={onCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCommit();
                }}
                className="w-16 shrink-0"
              />
              <div className="min-w-[9rem] flex-1">
                <ColorField
                  variant="inline"
                  label={`Stop ${index + 1} color`}
                  value={toColorValue(stop)}
                  onChange={(next) => updateStop(index, { color: next.color, alpha: next.alpha }, true)}
                  onCommit={onCommit}
                />
              </div>
              <IconButton
                icon={<Trash2 size={12} />}
                aria-label={`Remove stop ${index + 1}`}
                title="Remove stop"
                disabled={stops.length <= 2}
                onClick={() => removeStop(index)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" iconLeft={<ArrowLeftRight size={12} />} title="Reverse stops" onClick={reverse}>
          Reverse
        </Button>
        <Button
          variant="secondary"
          iconLeft={<AlignHorizontalDistributeCenter size={12} />}
          title="Distribute stops evenly"
          onClick={distribute}
        >
          Distribute
        </Button>
      </div>

      {isLinear && (
        <Slider
          variant="inline"
          label="Angle"
          unit="°"
          min="0"
          max="360"
          value={fill.angle ?? 90}
          onChange={(event) => onChange({ ...fill, angle: Number(event.target.value) }, true)}
          onCommit={onCommit}
        />
      )}

      {isAngular && (
        <Slider
          variant="inline"
          label="Start angle"
          unit="°"
          min="0"
          max="360"
          value={fill.angle ?? 0}
          onChange={(event) => onChange({ ...fill, angle: Number(event.target.value) }, true)}
          onCommit={onCommit}
        />
      )}

      {(isRadial || isDiamond || isAngular) && (
        <>
          <Slider
            variant="inline"
            label="Center X"
            unit="%"
            min="0"
            max="100"
            value={Math.round((fill.centerX ?? 0.5) * 100)}
            onChange={(event) => onChange({ ...fill, centerX: Number(event.target.value) / 100 }, true)}
            onCommit={onCommit}
          />
          <Slider
            variant="inline"
            label="Center Y"
            unit="%"
            min="0"
            max="100"
            value={Math.round((fill.centerY ?? 0.5) * 100)}
            onChange={(event) => onChange({ ...fill, centerY: Number(event.target.value) / 100 }, true)}
            onCommit={onCommit}
          />
          {(isRadial || isDiamond) && (
            <Slider
              variant="inline"
              label="Radius"
              unit="%"
              min="10"
              max="100"
              value={Math.round((fill.radius ?? 0.5) * 100)}
              onChange={(event) => onChange({ ...fill, radius: Number(event.target.value) / 100 }, true)}
              onCommit={onCommit}
            />
          )}
        </>
      )}
    </div>
  );
};
