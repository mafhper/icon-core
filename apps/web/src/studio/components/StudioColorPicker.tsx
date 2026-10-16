import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  formatColor,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHex,
  parseColorField,
  type PickerFormat
} from '../colorMath';

export interface StudioColorValue {
  /** `#rrggbb`. */
  color: string;
  /** 0..1. */
  alpha: number;
}

interface StudioColorPickerProps {
  label: string;
  value: StudioColorValue;
  onChange: (value: StudioColorValue, transient?: boolean) => void;
  onCommit?: () => void;
  disabled?: boolean;
  /**
   * Stroke carries no alpha channel: hide the alpha controls instead of
   * editing a value the document cannot store.
   */
  showAlpha?: boolean;
}

const FORMATS: PickerFormat[] = ['hex', 'rgb', 'hsl', 'hsb'];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Studio colour picker (Fase 4): OpenPencil-shaped, HSV-hearted.
 *
 * A 2D saturation/brightness area at the current hue, hue and alpha sliders,
 * and one value field whose format switches between hex, rgb, hsl and hsb —
 * the four dialects the parity study names, all computed from the single
 * `colorMath` core, with no OKHCL and (ground-0) no recents or library.
 *
 * The header row keeps the kit's `ColorField` contract (`Choose X`, `X hex`,
 * `X alpha percent`), so the swap inside `FillEditor` changes the picker,
 * never the callers. Drags report transiently and commit on release: one
 * gesture, one history entry, like the canvas transactions.
 */
export const StudioColorPicker = ({
  label,
  value,
  onChange,
  onCommit,
  disabled = false,
  showAlpha = true
}: StudioColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<PickerFormat>('hex');
  const [draft, setDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const hex = normalizeHex(value.color) ?? '#000000';
  const hsv = hexToHsv(hex) ?? { h: 0, s: 0, v: 0 };
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const alphaPct = Math.round(value.alpha * 100);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseColorField(draft, format);
    if (parsed) onChange({ ...value, color: parsed });
    setDraft(null);
    onCommit?.();
  };

  const setFromHsv = (h: number, s: number, v: number, transient: boolean) => {
    onChange(
      {
        ...value,
        color: hsvToHex({
          h: ((h % 360) + 360) % 360,
          s: clamp01(s),
          v: clamp01(v)
        })
      },
      transient
    );
  };

  const areaPointer = (clientX: number, clientY: number, transient: boolean) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setFromHsv(
      hsv.h,
      (clientX - rect.left) / rect.width,
      1 - (clientY - rect.top) / rect.height,
      transient
    );
  };

  const onAreaKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') setFromHsv(hsv.h, hsv.s - step, hsv.v, false);
    else if (event.key === 'ArrowRight') setFromHsv(hsv.h, hsv.s + step, hsv.v, false);
    else if (event.key === 'ArrowUp') setFromHsv(hsv.h, hsv.s, hsv.v + step, false);
    else if (event.key === 'ArrowDown') setFromHsv(hsv.h, hsv.s, hsv.v - step, false);
    else return;
    event.preventDefault();
    onCommit?.();
  };

  const hueCss = `hsl(${Math.round(hsv.h)}, 100%, 50%)`;
  const paintCss = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${showAlpha ? value.alpha : 1})`;

  return (
    <div className="studio-picker">
      <div className="flex h-[var(--ic-control-md)] min-w-0 flex-1 items-center overflow-hidden rounded-[var(--ic-field-radius)] bg-ic-elevated hover:bg-ic-overlay focus-within:ring-1 focus-within:ring-ic-accent-ring">
        <span
          className={`studio-checker ml-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-ic-border ${disabled ? 'opacity-40' : ''}`}
          role="img"
          aria-label={`${label} current colour`}
        >
          <span className="block h-full w-full rounded-[3px]" style={{ background: paintCss }} />
        </span>
        <span className="select-none pl-1 font-mono text-ic-text-muted">#</span>
        <input
          value={hexDraft ?? hex.slice(1).toUpperCase()}
          disabled={disabled}
          aria-label={`${label} hex`}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            // A text draft while typing, like NumberField: clearing the field
            // must not write back before the value is a colour.
            setHexDraft(event.target.value);
            const parsed = normalizeHex(event.target.value);
            if (parsed) onChange({ ...value, color: parsed }, true);
          }}
          onBlur={() => {
            setHexDraft(null);
            onCommit?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setHexDraft(null);
              onCommit?.();
            }
          }}
          className="min-w-0 flex-1 rounded-none bg-transparent p-0 font-mono text-[length:var(--ic-control-font-size)] uppercase text-ic-text outline-none disabled:opacity-40"
        />
        {showAlpha && (
          <>
            <span className="h-4 w-px shrink-0 bg-ic-border" />
            <input
              type="number"
              min="0"
              max="100"
              value={alphaDraft ?? String(alphaPct)}
              disabled={disabled}
              aria-label={`${label} alpha percent`}
              onChange={(event) => {
                setAlphaDraft(event.target.value);
                if (event.target.value.trim() === '') return;
                const next = Number(event.target.value);
                if (Number.isFinite(next)) onChange({ ...value, alpha: clamp01(next / 100) }, true);
              }}
              onBlur={() => {
                setAlphaDraft(null);
                onCommit?.();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setAlphaDraft(null);
                  onCommit?.();
                }
              }}
              className="w-8 shrink-0 rounded-none bg-transparent p-0 text-right tabular-nums text-[length:var(--ic-control-font-size)] text-ic-text outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
            />
            <span className="select-none pr-1 text-ic-text-muted">%</span>
          </>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${label} picker`}
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="shrink-0 p-1 text-ic-text-muted hover:text-ic-text disabled:opacity-40"
        >
          <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180' : ''} />
        </button>
      </div>

      {open && (
        <div className="studio-picker-body">
          <div
            ref={areaRef}
            role="group"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${label} saturation and brightness. Arrow keys adjust.`}
            className="studio-picker-satval"
            style={{ backgroundColor: hueCss }}
            onPointerDown={(event) => {
              if (disabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              areaPointer(event.clientX, event.clientY, true);
            }}
            onPointerMove={(event) => {
              if (disabled || !event.buttons) return;
              areaPointer(event.clientX, event.clientY, true);
            }}
            onPointerUp={() => onCommit?.()}
            onKeyDown={onAreaKey}
          >
            <div
              className="absolute inset-0 rounded-[8px]"
              style={{ background: 'linear-gradient(to right, rgb(255 255 255), transparent)' }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-[8px]"
              style={{ background: 'linear-gradient(to top, rgb(0 0 0), transparent)' }}
              aria-hidden="true"
            />
            <span
              className="studio-picker-cursor"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="studio-picker-sliders">
            <div
              role="group"
              aria-label={`${label} hue`}
              className="studio-picker-hue"
            >
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={Math.round(hsv.h)}
                disabled={disabled}
                aria-label={`${label} hue`}
                onChange={(event) => setFromHsv(Number(event.target.value), hsv.s, hsv.v, true)}
                onPointerUp={onCommit}
                onKeyUp={onCommit}
                className="h-full w-full cursor-ew-resize opacity-0"
              />
              <span
                className="studio-picker-thumb"
                style={{ left: `${(hsv.h / 360) * 100}%`, background: hueCss }}
                aria-hidden="true"
              />
            </div>
            {showAlpha && (
              <div className="studio-picker-alpha" role="group" aria-label={`${label} alpha`}>
                <div
                  className="studio-checker absolute inset-0 rounded-[6px]"
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 rounded-[6px]"
                  style={{
                    background: `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1))`
                  }}
                  aria-hidden="true"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={alphaPct}
                  disabled={disabled}
                  aria-label={`${label} alpha`}
                  onChange={(event) => onChange({ ...value, alpha: clamp01(Number(event.target.value) / 100) }, true)}
                  onPointerUp={onCommit}
                  onKeyUp={onCommit}
                  className="relative h-full w-full cursor-ew-resize opacity-0"
                />
                <span
                  className="studio-picker-thumb"
                  style={{ left: `${alphaPct}%`, background: paintCss }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
          <div className="studio-picker-formats">
            <label className="studio-picker-format-label">
              Format
              <select
                aria-label={`${label} format`}
                value={format}
                disabled={disabled}
                onChange={(event) => {
                  setFormat(event.target.value as PickerFormat);
                  setDraft(null);
                }}
                className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
              >
                {FORMATS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-picker-format-label">
              Value
              <input
                value={draft ?? formatColor(hex, format)}
                disabled={disabled}
                aria-label={`${label} ${format} value`}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setDraft(event.target.value);
                  const parsed = parseColorField(event.target.value, format);
                  if (parsed) onChange({ ...value, color: parsed }, true);
                }}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitDraft();
                  if (event.key === 'Escape') setDraft(null);
                }}
                className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 font-mono text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
