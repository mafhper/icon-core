import { useRef } from 'react';
import { AlignHorizontalDistributeCenter, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { GradientFill, GradientStop } from '@iconcore/shared';
import { Button, ColorField, IconButton, NumberField, Slider, type ColorValue } from '@iconcore/ui';
import { normalizeStops, sampleStops } from '@iconcore/renderer';

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
    const gaps = stops.slice(0, -1).map((stop, i) => ({
      index: i,
      size: stops[i + 1].offset - stop.offset
    }));
    const widest = gaps.sort((a, b) => b.size - a.size)[0];
    const left = stops[widest?.index ?? 0];
    const right = stops[(widest?.index ?? 0) + 1] ?? left;
    const offset = (left.offset + right.offset) / 2;
    const midpoint = sampleStops(stops, offset);
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(midpoint);
    const hex = match
      ? `#${[match[1], match[2], match[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
      : '#ffffff';
    const alpha = match?.[4] === undefined ? 1 : Number(match[4]);
    setStops([...stops, { offset, color: hex, alpha }].sort((a, b) => a.offset - b.offset));
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  const reverse = () => {
    const next = [...stops].reverse().map((stop) => ({ ...stop, offset: 1 - stop.offset }));
    setStops(next);
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
    <div className="ic-gradient-editor">
      <div
        ref={barRef}
        className="relative h-6 w-full cursor-pointer rounded-ic-sm border border-ic-border"
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
            aria-valuetext={`${Math.round(stop.offset * 100)}%`}
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
            className="ic-gradient-handle absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white shadow outline-none focus-visible:ring-2 focus-visible:ring-ic-accent-ring"
            style={{ left: `${stop.offset * 100}%`, background: stop.color }}
          />
        ))}
      </div>

      <div className="ic-gradient-presets mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="h-6 w-10 rounded-ic-sm border border-ic-border"
            style={{ background: barCss(preset.stops) }}
            title={`Apply ${preset.name}`}
            aria-label={`Apply ${preset.name} gradient`}
            onClick={() => setStops(preset.stops.map((stop) => ({ ...stop })))}
          />
        ))}
      </div>

      <div className="ic-gradient-stops mt-2 flex flex-col gap-2">
        {stops.map((stop, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <ColorField
                label={`Stop ${index + 1}`}
                value={toColorValue(stop)}
                onChange={(next) => updateStop(index, { color: next.color, alpha: next.alpha }, true)}
              />
            </div>
            <NumberField
              label="Pos"
              min="0"
              max="100"
              value={Math.round(stop.offset * 100)}
              onChange={(event) => updateStop(index, { offset: Number(event.target.value) / 100 }, true)}
            />
            <IconButton
              icon={<Trash2 size={12} />}
              aria-label={`Remove stop ${index + 1}`}
              disabled={stops.length <= 2}
              onClick={() => removeStop(index)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Button variant="secondary" iconLeft={<Plus size={12} />} onClick={addStop}>
          Stop
        </Button>
        <IconButton icon={<ArrowLeftRight size={12} />} aria-label="Reverse stops" onClick={reverse} />
        <IconButton
          icon={<AlignHorizontalDistributeCenter size={12} />}
          aria-label="Distribute stops evenly"
          onClick={distribute}
        />
      </div>

      {isLinear && (
        <Slider
          label={`Angle (${fill.angle ?? 90}°)`}
          min="0"
          max="360"
          value={fill.angle ?? 90}
          onChange={(event) => onChange({ ...fill, angle: Number(event.target.value) }, true)}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
      )}

      {isAngular && (
        <Slider
          label={`Start angle (${fill.angle ?? 0}°)`}
          min="0"
          max="360"
          value={fill.angle ?? 0}
          onChange={(event) => onChange({ ...fill, angle: Number(event.target.value) }, true)}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
      )}

      {(isRadial || isDiamond || isAngular) && (
        <div className="grid grid-cols-2 gap-2.5">
          <Slider
            label={`Center X (${Math.round((fill.centerX ?? 0.5) * 100)}%)`}
            min="0"
            max="100"
            value={Math.round((fill.centerX ?? 0.5) * 100)}
            onChange={(event) => onChange({ ...fill, centerX: Number(event.target.value) / 100 }, true)}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
          <Slider
            label={`Center Y (${Math.round((fill.centerY ?? 0.5) * 100)}%)`}
            min="0"
            max="100"
            value={Math.round((fill.centerY ?? 0.5) * 100)}
            onChange={(event) => onChange({ ...fill, centerY: Number(event.target.value) / 100 }, true)}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
          {(isRadial || isDiamond) && (
            <div className="col-span-2">
              <Slider
                label={`Radius (${Math.round((fill.radius ?? 0.5) * 100)}%)`}
                min="10"
                max="100"
                value={Math.round((fill.radius ?? 0.5) * 100)}
                onChange={(event) => onChange({ ...fill, radius: Number(event.target.value) / 100 }, true)}
                onPointerUp={onCommit}
                onKeyUp={onCommit}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
