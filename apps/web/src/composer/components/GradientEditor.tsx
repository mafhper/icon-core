import { useRef } from 'react';
import { AlignHorizontalDistributeCenter, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { GradientFill, GradientStop } from '@iconcore/shared';
import { Button, ColorField, IconButton, NumberField, Slider, type ColorValue } from '@iconcore/ui';
import { normalizeStops, sampleStopDetailed, sampleStops } from '@iconcore/renderer';

interface GradientEditorProps {
  fill: GradientFill;
  /** Transient update (no history commit). */
  onChange: (fill: GradientFill, transient?: boolean) => void;
  /** Commit the current value to history. */
  onCommit: () => void;
}

interface Preset {
  name: string;
  stops: GradientStop[];
}

const PRESETS: Preset[] = [
  { name: 'Sunset', stops: [{ offset: 0, color: '#ff7e5f' }, { offset: 1, color: '#feb47b' }] },
  { name: 'Ocean', stops: [{ offset: 0, color: '#2193b0' }, { offset: 1, color: '#6dd5ed' }] },
  { name: 'Violet', stops: [{ offset: 0, color: '#7028e4' }, { offset: 1, color: '#e5b2ca' }] },
  { name: 'Neon', stops: [{ offset: 0, color: '#00f5d4' }, { offset: 0.5, color: '#00bbf9' }, { offset: 1, color: '#f15bb5' }] },
  { name: 'Mono', stops: [{ offset: 0, color: '#f8fafc' }, { offset: 1, color: '#64748b' }] },
  { name: 'Fade out', stops: [{ offset: 0, color: '#ffffff', alpha: 1 }, { offset: 1, color: '#ffffff', alpha: 0 }] }
];

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

interface AdjustRowProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number, transient: boolean) => void;
  onCommit: () => void;
}

/**
 * A continuous gradient parameter: a slider for coarse dragging plus a matching
 * number field (`[ 90 ° ]`) for precision — the slider+number pairing used by
 * colour pickers, so both stay reachable in a 240px panel.
 */
const AdjustRow = ({ label, unit, min, max, value, onChange, onCommit }: AdjustRowProps) => (
  <div className="flex items-end gap-2">
    <div className="min-w-0 flex-1">
      <Slider
        variant="inline"
        label={label}
        min={String(min)}
        max={String(max)}
        value={value}
        onChange={(event) => onChange(Number(event.target.value), true)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
    <NumberField
      variant="inline"
      unit={unit}
      label={label}
      min={String(min)}
      max={String(max)}
      value={Math.round(value)}
      onChange={(event) => onChange(Number(event.target.value), true)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit();
      }}
      className="w-16 shrink-0"
    />
  </div>
);

/**
 * Gradient adjustments — the body of the unified `FillEditor` when the fill kind
 * is a gradient. Deliberately frameless: the Fill control already provides the
 * header (kind selector) and the inspector `Section` the grouping, so this must
 * not add a card. Stops are one aligned row each (`[pos %] [swatch #hex alpha %]
 * [remove]`) and continuous parameters use the slider+number pairing.
 */
export const GradientEditor = ({ fill, onChange, onCommit }: GradientEditorProps) => {
  const stops = normalizeStops(fill.stops);
  const barRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);

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
    <div className="grid gap-3.5">
      <div
        ref={barRef}
        className="relative mx-2 h-6 cursor-pointer rounded-ic-sm border border-ic-border"
        style={{ background: barCss(stops) }}
        onPointerMove={(event) => {
          if (dragIndex.current === null) return;
          updateStop(dragIndex.current, { offset: Number(offsetFromClientX(event.clientX).toFixed(3)) }, true);
        }}
        onPointerUp={() => {
          if (dragIndex.current !== null) {
            dragIndex.current = null;
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
              dragIndex.current = index;
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

      <div className="ic-gradient-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="ic-gradient-preset"
            style={{ background: barCss(preset.stops) }}
            title={`Apply ${preset.name}`}
            aria-label={`Apply ${preset.name} gradient`}
            onClick={() => setStops(preset.stops.map((stop) => ({ ...stop })))}
          />
        ))}
      </div>

      <div className="grid gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[length:var(--ic-label-size)] font-bold uppercase tracking-[0.04em] text-ic-text-muted">
            Stops
          </span>
          <IconButton icon={<Plus size={12} />} aria-label="Add stop" title="Add stop" onClick={addStop} />
        </div>

        <div className="grid gap-2.5">
          {stops.map((stop, index) => (
            <div key={index} className="flex items-center gap-2">
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
              <div className="min-w-0 flex-1">
                <ColorField
                  variant="inline"
                  label={`Stop ${index + 1} colour`}
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
        <AdjustRow
          label="Angle"
          unit="°"
          min={0}
          max={360}
          value={fill.angle ?? 90}
          onChange={(angle, transient) => onChange({ ...fill, angle }, transient)}
          onCommit={onCommit}
        />
      )}

      {isAngular && (
        <AdjustRow
          label="Start angle"
          unit="°"
          min={0}
          max={360}
          value={fill.angle ?? 0}
          onChange={(angle, transient) => onChange({ ...fill, angle }, transient)}
          onCommit={onCommit}
        />
      )}

      {(isRadial || isDiamond || isAngular) && (
        <>
          <AdjustRow
            label="Center X"
            unit="%"
            min={0}
            max={100}
            value={Math.round((fill.centerX ?? 0.5) * 100)}
            onChange={(value, transient) => onChange({ ...fill, centerX: value / 100 }, transient)}
            onCommit={onCommit}
          />
          <AdjustRow
            label="Center Y"
            unit="%"
            min={0}
            max={100}
            value={Math.round((fill.centerY ?? 0.5) * 100)}
            onChange={(value, transient) => onChange({ ...fill, centerY: value / 100 }, transient)}
            onCommit={onCommit}
          />
          {(isRadial || isDiamond) && (
            <AdjustRow
              label="Radius"
              unit="%"
              min={10}
              max={100}
              value={Math.round((fill.radius ?? 0.5) * 100)}
              onChange={(value, transient) => onChange({ ...fill, radius: value / 100 }, transient)}
              onCommit={onCommit}
            />
          )}
        </>
      )}
    </div>
  );
};
