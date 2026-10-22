import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SliderProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'onChange' | 'value' | 'defaultValue' | 'min' | 'max' | 'step'
  > {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  /** Visible label, wired to the input through `htmlFor`/`id`. */
  label?: ReactNode;
  /** Formats the readout and the `aria-valuetext` announced by assistive tech. */
  formatValue?: (value: number) => string;
  /** Hides the readout while keeping the value text for assistive tech. */
  hideValue?: boolean;
}

const TRACK =
  'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow';

const decimalsOf = (step: number): number => {
  const text = String(step);
  const dot = text.indexOf('.');

  return dot === -1 ? 0 : text.length - dot - 1;
};

/**
 * Native input sanitisation clamps to min/max but does not snap to `step` when the value
 * arrives from code, so the snap lives here. Rounding is done to the step's own precision
 * so `step: 0.1` cannot report `0.30000000000000004`.
 */
function snapToStep(raw: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(raw)) return min;

  const clamped = Math.min(max, Math.max(min, raw));
  if (step <= 0) return clamped;

  const snapped = min + Math.round((clamped - min) / step) * step;
  const bounded = Math.min(max, Math.max(min, snapped));

  return Number(bounded.toFixed(decimalsOf(step)));
}

/**
 * A styled `input[type=range]`. Keyboard support (arrows, Home/End, PageUp/PageDown)
 * is the browser's native range behaviour; adding a key handler here would move the
 * thumb twice per press.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    value,
    defaultValue,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
    label,
    formatValue,
    hideValue = false,
    className,
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? `ic-slider-${generatedId}`;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? min);
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;
  const format = formatValue ?? ((next: number) => String(next));

  return (
    <div className={cn('grid w-full gap-2', className)}>
      {(label !== undefined || !hideValue) && (
        <div className="flex items-baseline justify-between gap-3">
          {label !== undefined && (
            <label htmlFor={inputId} className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          {!hideValue && (
            <output htmlFor={inputId} aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
              {format(current)}
            </output>
          )}
        </div>
      )}

      <input
        {...rest}
        ref={ref}
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        aria-valuetext={formatValue ? format(current) : undefined}
        className={TRACK}
        onChange={(event) => {
          const next = snapToStep(Number(event.currentTarget.value), min, max, step);

          if (!isControlled) setUncontrolled(next);
          onValueChange?.(next);
        }}
      />
    </div>
  );
});
