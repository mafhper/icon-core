import { useCallback, useEffect, useRef, useState } from 'react';
import { AlignHorizontalDistributeCenter, ArrowLeftRight, Blend, ChevronDown, Plus, Square, Trash2 } from 'lucide-react';
import type { Fill, GradientFill, GradientStop } from '@iconcore/shared';
import { normalizeStops, sampleStopDetailed, sampleStops } from '@iconcore/renderer';
import { Button, NumberField, Popover, Slider } from '@iconcore/ui';
import { convertFillKind, FILL_KIND_OPTIONS } from '../../composer/utils/fill';
import { FALLBACK_SOLID_HEX } from '../../composer/constants';
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
  /**
   * Fill-kind tabs in the floating panel (OpenPencil parity).
   *
   * When both are present, the floating body grows the reference's header:
   * Solid first, linear gradient second, in the same row disposition. The
   * gradient tab lands on `linear-gradient` and stays pressed for any of the
   * four gradient kinds — the subtypes keep living in the kind selector, the
   * way the reference keeps them in its gradient panel. Kinds the engine
   * cannot paint (image, shader and the rest) get no button: a control that
   * does nothing does not exist.
   *
   * Only the fill's own picker passes these (via `FillEditor`): stop, stroke
   * and shadow pickers edit a colour, never a kind.
   */
  fillKind?: Fill['kind'];
  onFillKindChange?: (kind: Fill['kind']) => void;
  /**
   * Gradient under edit for the floating body (OpenPencil parity).
   *
   * When `fillKind` is a gradient kind and these are present, the floating
   * panel stays open and its body swaps to the gradient editor (subtype
   * select, stop bar, stop list, active-stop colour) instead of unmounting
   * the picker — the defect where the gradient tab closed the modal and left
   * the edit to the sidebar. Solid-only callers (stroke, shadow, per-stop
   * rows) leave these absent and keep the solid body.
   */
  gradientFill?: GradientFill;
  onGradientChange?: (fill: GradientFill, transient?: boolean) => void;
  onGradientCommit?: () => void;
}

const FORMATS: PickerFormat[] = ['hex', 'rgb', 'hsl', 'hsb'];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * The OpenPencil surface itself (S/V area, hue/alpha sliders, format
 * fields): one definition, shared by the solid picker and the floating
 * gradient's active stop. `dismissOnEnter` + `onDismiss` only differ: the
 * solid floating body confirms and closes on Enter, the active-stop body
 * commits and stays open (closing there would drop the gradient edit).
 */
const SolidColorBody = ({
  label,
  value,
  onChange,
  onCommit,
  showAlpha,
  disabled = false,
  inPopover,
  dismissOnEnter,
  onDismiss
}: {
  label: string;
  value: StudioColorValue;
  onChange: (value: StudioColorValue, transient?: boolean) => void;
  onCommit?: () => void;
  showAlpha: boolean;
  disabled?: boolean;
  inPopover: boolean;
  dismissOnEnter: boolean;
  onDismiss?: () => void;
}) => {
  const [format, setFormat] = useState<PickerFormat>('hex');
  const [draft, setDraft] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  // The surface is shared: the floating gradient reuses one instance for
  // whichever stop is active. A text draft belongs to the stop it was typed
  // for — switching stops drops it instead of showing one stop's draft in
  // another's field. The format choice survives: it is a viewer preference,
  // not part of the stop.
  useEffect(() => {
    setDraft(null);
  }, [label]);

  const hex = normalizeHex(value.color) ?? FALLBACK_SOLID_HEX;
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

  const commitValueField = (dismissAfter: boolean) => {
    commitDraft();
    if (!dismissAfter) return;
    onDismiss?.();
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
              if (event.key === 'Enter') commitValueField(inPopover && dismissOnEnter);
              if (event.key === 'Escape') setDraft(null);
            }}
            className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 font-mono text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
          />
        </label>
      </div>
    </div>
  );
};

/**
 * Stop-bar helpers shared with the sidebar gradient editor (same motor, same
 * presentation): the bar samples through `sampleStops` so the preview matches
 * the renderer, and every stop keeps a stable `id` so React keys survive a
 * reorder. The motor itself (`normalizeStops`, `sampleStopDetailed`) is never
 * reimplemented here.
 */
const GRADIENT_BAR_SAMPLES = 20;

const floatingBarCss = (stops: GradientStop[]): string => {
  const samples = Array.from({ length: GRADIENT_BAR_SAMPLES + 1 }, (_, i) => i / GRADIENT_BAR_SAMPLES);
  return `linear-gradient(90deg, ${samples
    .map((t) => `${sampleStops(stops, t)} ${Math.round(t * 100)}%`)
    .join(', ')})`;
};

const floatingPct = (value: number): string => `${Math.round(value * 100)}%`;

let floatingStopSeq = 0;
const withFloatingStopIds = (stops: GradientStop[]): GradientStop[] =>
  stops.map((stop) => (stop.id ? stop : { ...stop, id: `fstop-${(floatingStopSeq += 1)}` }));

const toFloatingColorValue = (stop: GradientStop): StudioColorValue => ({
  color: stop.color,
  alpha: stop.alpha ?? 1
});

/**
 * Floating gradient body (OpenPencil parity, inside the popover).
 *
 * Subtype select, stop bar (click adds, drag moves), stop list (position %,
 * swatch selecting the active stop, alpha %, remove) and the active stop's
 * colour through the shared solid surface — the same four subtypes and the
 * same stop fields (`offset`, `color`, `alpha`) the engine paints, no field
 * the model does not have. Geometry (angle/centre/radius) follows the kind,
 * like the sidebar editor. Presets stay in the sidebar: they are library
 * conveniences, not model fields, and would bloat the popover.
 */
const FloatingGradientBody = ({
  label,
  fill,
  onChange,
  onCommit,
  disabled = false
}: {
  label: string;
  fill: GradientFill;
  onChange: (fill: GradientFill, transient?: boolean) => void;
  onCommit: () => void;
  disabled?: boolean;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [activeStop, setActiveStop] = useState(0);
  // While a stop is dragged the list must NOT be re-sorted: the array is sorted by
  // offset, so crossing a neighbour would make the index under the pointer refer to
  // a different stop. The order is restored (sorted) on commit.
  const stops =
    dragging !== null && fill.stops && fill.stops.length >= 2 ? fill.stops : normalizeStops(fill.stops);
  const activeIndex = Math.max(0, Math.min(activeStop, stops.length - 1));
  const active = stops[activeIndex];

  const setStops = (next: GradientStop[], transient = false) => {
    onChange({ ...fill, stops: withFloatingStopIds(next) }, transient);
  };

  const updateStop = (index: number, patch: Partial<GradientStop>, transient = false) => {
    setStops(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)), transient);
    if (!transient) setActiveStop(index);
    else setActiveStop((current) => (current === index ? current : current));
  };

  const selectStop = (index: number) => setActiveStop(index);

  const addStop = () => {
    const gaps = stops.slice(0, -1).map((stop, i) => ({ index: i, size: stops[i + 1].offset - stop.offset }));
    const widest = gaps.sort((a, b) => b.size - a.size)[0];
    const left = stops[widest?.index ?? 0];
    const right = stops[(widest?.index ?? 0) + 1] ?? left;
    const offset = (left.offset + right.offset) / 2;
    const { color, alpha } = sampleStopDetailed(stops, offset);
    const next = [...stops, { offset, color, alpha }].sort((a, b) => a.offset - b.offset);
    setStops(next);
    setActiveStop(next.findIndex((stop) => stop.offset === offset && stop.color === color));
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
    setActiveStop((current) => Math.max(0, Math.min(current, stops.length - 2)));
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

  const gradientOptions = FILL_KIND_OPTIONS.filter(
    (option) => option.value !== 'solid' && option.value !== 'none'
  );

  const isLinear = fill.kind === 'linear-gradient';
  const isAngular = fill.kind === 'angular-gradient';
  const isRadial = fill.kind === 'radial-gradient';
  const isDiamond = fill.kind === 'diamond-gradient';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <label className="studio-picker-format-label">
        Gradient type
        <select
          aria-label={`${label} gradient type`}
          value={fill.kind}
          disabled={disabled}
          onChange={(event) => {
            const next = convertFillKind(fill, event.target.value as Fill['kind']) as GradientFill;
            onChange(next);
          }}
          className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
        >
          {gradientOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div
        ref={barRef}
        aria-label={`${label} gradient bar. Activate a stop, then use arrows to move it.`}
        className="relative mx-2 h-6 cursor-pointer rounded-ic-sm border border-ic-border"
        style={{ background: floatingBarCss(stops) }}
        onPointerDown={(event) => {
          if (disabled) return;
          // The bar advertises `cursor-pointer`: clicking it adds a stop there and
          // starts dragging it. Handles have their own pointerdown.
          if ((event.target as HTMLElement).closest('.ic-gradient-handle')) return;
          const offset = Number(offsetFromClientX(event.clientX).toFixed(3));
          const { color, alpha } = sampleStopDetailed(stops, offset);
          const next = [...stops, { offset, color, alpha }].sort((a, b) => a.offset - b.offset);
          setStops(next);
          const added = next.findIndex((stop) => stop.offset === offset && stop.color === color);
          setDragging(added);
          setActiveStop(added);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging === null || disabled) return;
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
            key={stop.id ?? index}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Stop ${index + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(stop.offset * 100)}
            aria-valuetext={floatingPct(stop.offset)}
            onPointerDown={(event) => {
              if (disabled) return;
              setDragging(index);
              setActiveStop(index);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (disabled) return;
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
            onFocus={() => setActiveStop(index)}
            className="ic-gradient-handle"
            style={{
              left: floatingPct(stop.offset),
              background: stop.color,
              outline: index === activeIndex ? '2px solid var(--ic-accent-ring)' : undefined,
              outlineOffset: index === activeIndex ? '1px' : undefined
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
            Stops {stops.length > 2 ? `(${stops.length})` : ''}
          </span>
          <Button
            variant="ghost"
            iconLeft={<Plus size={12} />}
            title="Add a stop at the widest gap"
            aria-label="Add gradient stop"
            disabled={disabled}
            onClick={addStop}
          >
            Add stop
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {stops.map((stop, index) => (
            <div key={stop.id ?? index} className="flex flex-wrap items-center gap-2">
              <NumberField
                variant="inline"
                unit="%"
                label={`Stop ${index + 1} position`}
                min="0"
                max="100"
                value={Math.round(stop.offset * 100)}
                disabled={disabled}
                onChange={(event) => updateStop(index, { offset: Number(event.target.value) / 100 }, true)}
                onBlur={onCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCommit();
                }}
                className="w-16 shrink-0"
              />
              <button
                type="button"
                disabled={disabled}
                aria-label={`Select stop ${index + 1}`}
                aria-pressed={index === activeIndex}
                data-active={index === activeIndex ? true : undefined}
                title={`Select stop ${index + 1}`}
                onClick={() => selectStop(index)}
                className="studio-checker h-4 w-4 shrink-0 rounded-[3px] border border-ic-border disabled:opacity-40"
              >
                <span
                  className="block h-full w-full rounded-[3px]"
                  style={{ background: `rgba(0, 0, 0, 0)` }}
                >
                  <span
                    className="block h-full w-full rounded-[3px]"
                    style={{ background: stop.color }}
                    aria-hidden="true"
                  />
                </span>
              </button>
              <NumberField
                variant="inline"
                unit="%"
                label={`Stop ${index + 1} alpha`}
                min="0"
                max="100"
                value={Math.round((stop.alpha ?? 1) * 100)}
                disabled={disabled}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  updateStop(index, { alpha: clamp01(next / 100) }, true);
                }}
                onBlur={onCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCommit();
                }}
                className="w-16 shrink-0"
              />
              <button
                type="button"
                disabled={disabled || stops.length <= 2}
                aria-label={`Remove stop ${index + 1}`}
                title="Remove stop"
                onClick={() => removeStop(index)}
                className="shrink-0 rounded-[var(--ic-field-radius)] p-1.5 text-ic-text-muted hover:text-ic-text disabled:opacity-40"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          iconLeft={<ArrowLeftRight size={12} />}
          title="Reverse stops"
          disabled={disabled}
          onClick={reverse}
        >
          Reverse
        </Button>
        <Button
          variant="secondary"
          iconLeft={<AlignHorizontalDistributeCenter size={12} />}
          title="Distribute stops evenly"
          disabled={disabled}
          onClick={distribute}
        >
          Distribute
        </Button>
      </div>

      {active && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <span className="text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
            Stop {activeIndex + 1} color
          </span>
          <SolidColorBody
            label={`Stop ${activeIndex + 1} color`}
            value={toFloatingColorValue(active)}
            showAlpha
            disabled={disabled}
            inPopover
            dismissOnEnter={false}
            onChange={(next, transient) =>
              updateStop(activeIndex, { color: next.color, alpha: next.alpha }, transient)
            }
            onCommit={onCommit}
          />
        </div>
      )}

      {isLinear && (
        <Slider
          variant="inline"
          label="Angle"
          unit="°"
          min="0"
          max="360"
          value={fill.angle ?? 90}
          disabled={disabled}
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
          disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
              disabled={disabled}
              onChange={(event) => onChange({ ...fill, radius: Number(event.target.value) / 100 }, true)}
              onCommit={onCommit}
            />
          )}
        </>
      )}
    </div>
  );
};

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
 *
 * Two triggers, one body: the chevron expands the body inline in the sidebar
 * (the Fase 4 behaviour), while the colour swatch opens the same body in a
 * floating `Popover` anchored to the swatch (OpenPencil parity). The two are
 * exclusive — opening one closes the other. The floating panel dismisses on
 * Escape, outside click and viewport change, moves focus in on open and back
 * to the swatch on keyboard dismissal; continuous edits (drags, typing) never
 * dismiss, only an explicit Enter in the value field confirms and closes.
 *
 * With a gradient kind the floating body swaps to the gradient editor
 * (subtype select, stop bar, stop list, active-stop colour through the same
 * solid surface) and stays open across solid↔gradient switches: the picker
 * instance is kept mounted by `FillEditor`, so the tab no longer unmounts
 * the modal back to the sidebar.
 */
export const StudioColorPicker = ({
  label,
  value,
  onChange,
  onCommit,
  disabled = false,
  showAlpha = true,
  fillKind,
  onFillKindChange,
  gradientFill,
  onGradientChange,
  onGradientCommit
}: StudioColorPickerProps) => {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const popoverBodyRef = useRef<HTMLDivElement>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<string | null>(null);

  const hex = normalizeHex(value.color) ?? FALLBACK_SOLID_HEX;
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const alphaPct = Math.round(value.alpha * 100);
  const paintCss = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${showAlpha ? value.alpha : 1})`;

  /**
   * Explicit confirmation inside the floating panel (Enter in the value
   * field): commit exactly like inline, then dismiss and return focus to the
   * swatch that opened it. Drags and typing never dismiss — only this
   * deliberate take-this-colour does.
   */
  const dismissPopoverToSwatch = () => {
    setPopoverOpen(false);
    swatchRef.current?.focus();
  };

  /**
   * Every `Popover` dismissal path (outside click, Escape, viewport change)
   * funnels here. Focus returns to the swatch only when it was inside the
   * panel (keyboard dismissal): on an outside pointer dismissal focus is
   * already where the person put it and must not be stolen back.
   */
  const handlePopoverClose = useCallback(() => {
    const focusInside = popoverBodyRef.current?.contains(document.activeElement) ?? false;
    setPopoverOpen(false);
    if (focusInside) swatchRef.current?.focus();
  }, []);

  // Floating-panel focus contract: move into the panel on open (the S/V area
  // group is the first tabbable surface), so keyboard dismissal can return.
  // The move never scrolls: the panel is placed next to the trigger and
  // already visible, and any scroll on open would read as a viewport change
  // and dismiss the panel that just opened.
  useEffect(() => {
    if (!popoverOpen) return;
    const focusFirst = () => {
      const body = popoverBodyRef.current;
      const first = body?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (first ?? body)?.focus?.({ preventScroll: true });
    };
    if (typeof requestAnimationFrame !== 'function') {
      focusFirst();
      return;
    }
    const frame = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(frame);
  }, [popoverOpen]);

  /**
   * The reference's gradient tab covers all four gradient subtypes (its swap
   * always lands on linear); the pressed state does the same here so a radial
   * fill reached through the kind selector still reads as gradient.
   */
  const isGradientKind = (kind: Fill['kind']): boolean =>
    kind === 'linear-gradient' ||
    kind === 'radial-gradient' ||
    kind === 'angular-gradient' ||
    kind === 'diamond-gradient';

  const showingGradient =
    fillKind !== undefined &&
    isGradientKind(fillKind) &&
    gradientFill !== undefined &&
    onGradientChange !== undefined;

  /** Kind tabs never fire for the kind already showing, like the reference. */
  const switchFillKind = (kind: Fill['kind']) => {
    if (kind !== fillKind) onFillKindChange?.(kind);
  };

  const fillKindTabClass = (active: boolean): string =>
    active
      ? 'bg-ic-accent-soft text-ic-accent-text'
      : 'text-ic-text-muted hover:text-ic-text';

  /**
   * The OpenPencil header itself: one row of kind tabs above the colour
   * surface. Floating-only — inline already has the kind selector above it,
   * and a second switcher there would be the same control twice.
   */
  const renderFillKindHeader = () =>
    fillKind !== undefined && onFillKindChange ? (
      <div className="mb-2 flex items-center gap-0.5" role="group" aria-label={`${label} fill type`}>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label} fill type: Solid color`}
          title="Solid color"
          aria-pressed={fillKind === 'solid'}
          data-active={fillKind === 'solid' ? true : undefined}
          onClick={() => switchFillKind('solid')}
          className={`rounded-[var(--ic-field-radius)] p-1.5 disabled:opacity-40 ${fillKindTabClass(fillKind === 'solid')}`}
        >
          <Square size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label} fill type: Linear gradient`}
          title="Linear gradient"
          aria-pressed={isGradientKind(fillKind)}
          data-active={isGradientKind(fillKind) ? true : undefined}
          onClick={() => switchFillKind('linear-gradient')}
          className={`rounded-[var(--ic-field-radius)] p-1.5 disabled:opacity-40 ${fillKindTabClass(isGradientKind(fillKind))}`}
        >
          <Blend size={14} aria-hidden="true" />
        </button>
      </div>
    ) : null;

  const renderSolidHeader = () => (
    <div className="flex h-[var(--ic-control-md)] min-w-0 flex-1 items-center overflow-hidden rounded-[var(--ic-field-radius)] bg-ic-elevated hover:bg-ic-overlay focus-within:ring-1 focus-within:ring-ic-accent-ring">
      <button
        type="button"
        ref={swatchRef}
        disabled={disabled}
        aria-label={`Choose ${label} color`}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        title={`Choose ${label} color`}
        onClick={() => {
          // The floating trigger: the same body as the chevron, portalled
          // next to the swatch. Exclusive with the inline body below.
          if (popoverOpen) setPopoverOpen(false);
          else {
            setInlineOpen(false);
            setPopoverOpen(true);
          }
        }}
        className={`studio-checker ml-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-ic-border ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
      >
        <span className="block h-full w-full rounded-[3px]" style={{ background: paintCss }} />
      </button>
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
        aria-label={`${inlineOpen ? 'Collapse' : 'Expand'} ${label} picker`}
        aria-expanded={inlineOpen}
        onClick={() => {
          // The inline trigger: the body stays embedded in the sidebar, as
          // since Fase 4. Exclusive with the floating swatch panel.
          if (!inlineOpen) setPopoverOpen(false);
          setInlineOpen((was) => !was);
        }}
        className="shrink-0 p-1 text-ic-text-muted hover:text-ic-text disabled:opacity-40"
      >
        <ChevronDown size={14} aria-hidden="true" className={inlineOpen ? 'rotate-180' : ''} />
      </button>
    </div>
  );

  /**
   * Gradient header: the fill has no single colour, so the hex/alpha wells
   * and the inline chevron (whose body is the sidebar gradient editor below)
   * give way to a gradient swatch that opens the floating gradient body.
   * The swatch keeps the `Choose X color` contract so the trigger is found
   * the same way in both kinds.
   */
  const renderGradientHeader = () => {
    const preview = gradientFill ? floatingBarCss(normalizeStops(gradientFill.stops)) : paintCss;
    return (
      <div className="flex h-[var(--ic-control-md)] min-w-0 flex-1 items-center overflow-hidden rounded-[var(--ic-field-radius)] bg-ic-elevated hover:bg-ic-overlay focus-within:ring-1 focus-within:ring-ic-accent-ring">
        <button
          type="button"
          ref={swatchRef}
          disabled={disabled}
          aria-label={`Choose ${label} color`}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          title={`Choose ${label} gradient`}
          onClick={() => {
            if (popoverOpen) setPopoverOpen(false);
            else {
              setInlineOpen(false);
              setPopoverOpen(true);
            }
          }}
          className={`ml-0.5 h-4 w-10 shrink-0 rounded-[3px] border border-ic-border ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          style={{ background: preview }}
        />
        <span className="min-w-0 flex-1 truncate pl-2 text-[length:var(--ic-control-font-size)] text-ic-text-muted">
          Gradient
        </span>
      </div>
    );
  };

  return (
    <div className="studio-picker">
      {showingGradient ? renderGradientHeader() : renderSolidHeader()}

      {!showingGradient && inlineOpen && (
        <SolidColorBody
          label={label}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          showAlpha={showAlpha}
          disabled={disabled}
          inPopover={false}
          dismissOnEnter={false}
        />
      )}

      <Popover
        open={popoverOpen}
        anchorRef={swatchRef}
        onClose={handlePopoverClose}
        width={300}
        estimatedHeight={showingGradient ? 560 : 380}
        aria-label={`${label} picker`}
        className={showingGradient ? 'max-h-[70vh] overflow-y-auto' : undefined}
      >
        <div ref={popoverBodyRef} tabIndex={-1} className="outline-none">
          {popoverOpen &&
            (showingGradient && gradientFill && onGradientChange ? (
              <div className="studio-picker-body">
                {renderFillKindHeader()}
                <FloatingGradientBody
                  label={label}
                  fill={gradientFill}
                  onChange={onGradientChange}
                  onCommit={onGradientCommit ?? onCommit ?? (() => {})}
                  disabled={disabled}
                />
              </div>
            ) : (
              <div className="studio-picker-body">
                {renderFillKindHeader()}
                <SolidColorBody
                  label={label}
                  value={value}
                  onChange={onChange}
                  onCommit={onCommit}
                  showAlpha={showAlpha}
                  disabled={disabled}
                  inPopover
                  dismissOnEnter
                  onDismiss={dismissPopoverToSwatch}
                />
              </div>
            ))}
        </div>
      </Popover>
    </div>
  );
};
