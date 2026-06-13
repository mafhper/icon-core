import { Plus, Trash2 } from 'lucide-react';
import type { Fill } from '@iconcore/shared';

interface GradientEditorProps {
  fill: Fill;
  /** Transient update (no history commit). */
  onChange: (fill: Fill) => void;
  /** Commit the current value to history. */
  onCommit: () => void;
}

type Stops = NonNullable<Fill['stops']>;

const PRESETS: Array<{ name: string; stops: Stops }> = [
  { name: 'Gold / Cyan', stops: [{ offset: 0, color: '#f3d18a' }, { offset: 1, color: '#6bb7d8' }] },
  { name: 'Sunset', stops: [{ offset: 0, color: '#ff7e5f' }, { offset: 1, color: '#feb47b' }] },
  { name: 'Ocean', stops: [{ offset: 0, color: '#2193b0' }, { offset: 1, color: '#6dd5ed' }] },
  { name: 'Violet', stops: [{ offset: 0, color: '#7028e4' }, { offset: 1, color: '#e5b2ca' }] },
  { name: 'Forest', stops: [{ offset: 0, color: '#134e5e' }, { offset: 1, color: '#71b280' }] },
  { name: 'Mono', stops: [{ offset: 0, color: '#f8fafc' }, { offset: 1, color: '#64748b' }] }
];

const sortStops = (stops: Stops): Stops => [...stops].sort((a, b) => a.offset - b.offset);

const cssRamp = (stops: NonNullable<Fill['stops']>): string =>
  `linear-gradient(90deg, ${sortStops(stops).map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`;

export const GradientEditor = ({ fill, onChange, onCommit }: GradientEditorProps) => {
  if (fill.kind === 'solid') return null;
  const stops = fill.stops ?? [];

  const setStops = (next: NonNullable<Fill['stops']>, commit = true) => {
    onChange({ ...fill, stops: sortStops(next) });
    if (commit) onCommit();
  };

  const updateStop = (index: number, patch: Partial<{ offset: number; color: string }>, commit = true) => {
    setStops(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)), commit);
  };

  const addStop = () => {
    const mid = stops.length ? stops[Math.floor(stops.length / 2)].color : '#ffffff';
    setStops([...stops, { offset: 0.5, color: mid }]);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  return (
    <div className="ic-gradient-editor">
      <div className="ic-gradient-preview" style={{ background: cssRamp(stops) }} aria-hidden="true" />

      <div className="ic-gradient-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="ic-gradient-preset"
            style={{ background: cssRamp(preset.stops) }}
            title={preset.name}
            aria-label={`Apply ${preset.name} gradient`}
            onClick={() => setStops(preset.stops.map((s) => ({ ...s })))}
          />
        ))}
      </div>

      <div className="ic-gradient-stops">
        {stops.map((stop, index) => (
          <div key={index} className="ic-gradient-stop">
            <input
              type="color"
              value={stop.color}
              onChange={(e) => updateStop(index, { color: e.target.value })}
              aria-label={`Stop ${index + 1} color`}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(stop.offset * 100)}
              onChange={(e) => updateStop(index, { offset: Number(e.target.value) / 100 }, false)}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
              aria-label={`Stop ${index + 1} position`}
            />
            <span className="ic-gradient-stop-val">{Math.round(stop.offset * 100)}%</span>
            <button
              type="button"
              className="ic-gradient-stop-remove"
              disabled={stops.length <= 2}
              onClick={() => removeStop(index)}
              aria-label={`Remove stop ${index + 1}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button type="button" className="ic-gradient-add" onClick={addStop}>
          <Plus size={12} />
          Add stop
        </button>
      </div>

      {fill.kind === 'linear-gradient' ? (
        <label className="ic-field">
          <span>Angle ({fill.angle ?? 135}°)</span>
          <input
            type="range"
            min="0"
            max="360"
            value={fill.angle ?? 135}
            onChange={(e) => onChange({ ...fill, angle: Number(e.target.value) })}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
        </label>
      ) : (
        <div className="ic-field-grid">
          <label className="ic-field">
            <span>Center X ({Math.round((fill.centerX ?? 0.5) * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round((fill.centerX ?? 0.5) * 100)}
              onChange={(e) => onChange({ ...fill, centerX: Number(e.target.value) / 100 })}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
            />
          </label>
          <label className="ic-field">
            <span>Center Y ({Math.round((fill.centerY ?? 0.5) * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round((fill.centerY ?? 0.5) * 100)}
              onChange={(e) => onChange({ ...fill, centerY: Number(e.target.value) / 100 })}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
            />
          </label>
          <label className="ic-field">
            <span>Radius ({Math.round((fill.radius ?? 0.5) * 100)}%)</span>
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round((fill.radius ?? 0.5) * 100)}
              onChange={(e) => onChange({ ...fill, radius: Number(e.target.value) / 100 })}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
            />
          </label>
        </div>
      )}
    </div>
  );
};
