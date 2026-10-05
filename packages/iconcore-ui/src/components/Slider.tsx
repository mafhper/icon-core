import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import { NumberField } from './NumberField';

/** One clickable marker on the track. */
export interface SliderMark {
  /** Position in slider units. `null` omits the mark rather than clamping it. */
  px: number | null;
  /** Glyph drawn on the tick. */
  label: string;
  /** Accessible name. Never the glyph alone. */
  description: string;
}

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Field label. Plain name — the value lives in the paired number field. */
  label: string;
  /** Optional explanatory copy under the slider. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above the slider only; `inline` pairs the
   * slider with a number field — the panel's single language for a bounded
   * numeric property, so the same quantity is never a slider in one place and a
   * bare number in another.
   */
  variant?: 'field' | 'inline';
  /** Value shown at the right of an `inline` label row (state, not a control). */
  valueLabel?: ReactNode;
  /** Hide the label row (used when a sibling composes its own label). */
  hideLabel?: boolean;
  /**
   * Markers under the track. Clicking one calls `onMark`.
   *
   * The frame-radius slider is the reason this exists: 0, 24, 115 and 256 are not
   * numbers a person can find on a track, they are the **defaults of four icon
   * shapes**. A tick that can be clicked turns "what is 115?" into "what is
   * squircle?".
   *
   * `px` is the position **in slider units** — the consumer computes it from the
   * shape's own default, because only it knows the canvas size. The kit does not
   * second-guess it, and `px == null` simply omits that mark.
   */
  marks?: readonly SliderMark[];
  /** Fired with the mark's own value. The consumer decides what to do with it. */
  onMark?: (mark: SliderMark) => void;
  /** Unit for the paired number field (`%`, `°`, `px`, `×`). Enables the pairing. */
  unit?: ReactNode;
  /** Commit once when the value settles (slider release, number blur or Enter). */
  onCommit?: () => void;
}

/**
 * Labelled range slider. `variant="inline"` + `unit` renders the panel's standard
 * numeric row: `label` above, then `[slider] [number unit]`. The consumer keeps
 * the model in its own units; the number field shows the same value and commits
 * through `onCommit`, so a drag is still one undo transaction.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    className,
    label,
    hint,
    variant = 'field',
    valueLabel,
    hideLabel = false,
    unit,
    marks,
    onMark,
    onCommit,
    onPointerUp,
    onKeyUp,
    ...rest
  },
  ref
) {
  const commit = () => onCommit?.();
  const step = rest.step === undefined ? 1 : Number(rest.step);
  const rawValue = Number(rest.value ?? 0);
  const displayValue = step < 1 ? Number(rawValue.toFixed(2)) : Math.round(rawValue);

  const min = Number(rest.min ?? 0);
  const max = Number(rest.max ?? 100);
  const span = max - min;

  /**
   * The tick row under the track.
   *
   * Positioning is **percentual**, not `left: <px>`: the input is `w-full`, e o px
   * pertence ao documento, nao ao slider. `radiusMarkValue` ja devolveu `null` para o
   * que esta fora do alcance — aqui isso vira `display: none`, e nao uma marca em
   * `left: -180px` que some do container mas continua no fluxo.
   */
  const marcas = marks?.filter((m) => m.px != null) ?? [];
  const track =
    marcas.length > 0 ? (
      <div className="relative mt-1 h-4" aria-hidden="false">
        {marcas.map((marca) => (
          <button
            key={marca.description}
            type="button"
            // `aria-label` e nao `title`: um `title` so aparece no hover, e uma marca
            // cujo unico nome e um glifo quadrado nao diz o que ela faz.
            aria-label={`${marca.description} — ${marca.px}${unit ?? ''}`}
            onClick={() => onMark?.(marca)}
            style={{
              left: `${span > 0 ? (((marca.px as number) - min) / span) * 100 : 0}%`,
              // O glifo e **centralizado** na marca: `translate(-50%)` junto com o
              // `left` em %, para a marca ficar em cima do valor e nao do intervalo.
              transform: 'translateX(-50%)'
            }}
            className="absolute top-0 -ml-[0.4rem] cursor-pointer border-0 bg-transparent p-0 text-[0.62rem] leading-none text-ic-text-muted hover:text-ic-accent-text focus-visible:ring-2 focus-visible:ring-ic-accent-text"
          >
            {marca.label}
          </button>
        ))}
      </div>
    ) : null;

  const input = (
    <input
      ref={ref}
      type="range"
      /**
       * The `inline` variant prints the label as a **plain `<span>`**, so nothing
       * associated the text with the control: the range had **no accessible name**,
       * and `getByLabel('Radius')` could not find it.
       *
       * A `<span>` next to an input is not a label. This is the fix, and it is also
       * what makes the control addressable by name in a test — which is what caught
       * it, because a probe by index had been quietly dragging a different slider.
       *
       * `aria-label` rather than `<label for>`: the two consumers render either a
       * label row with no `id`, or the label visually hidden, and threading a generated
       * `id` through both layouts would be a bigger change than the bug needs.
       */
      aria-label={label}
      className={cn('w-full', className)}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        commit();
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        commit();
      }}
      {...rest}
    />
  );

  if (variant === 'inline') {
    const showLabelRow = !hideLabel || valueLabel != null;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {showLabelRow && (
          <div className="flex items-baseline justify-between gap-2">
            {!hideLabel && (
              <span className="min-w-0 truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
                {label}
              </span>
            )}
            {valueLabel != null && (
              <span className="text-[0.72rem] font-medium tabular-nums text-ic-text">{valueLabel}</span>
            )}
          </div>
        )}

        {unit == null ? (
          input
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{input}{track}</div>
            <NumberField
              variant="inline"
              unit={unit}
              label={label}
              min={rest.min as string | undefined}
              max={rest.max as string | undefined}
              step={rest.step as string | undefined}
              value={displayValue}
              onChange={(event) => {
                // Route the paired field through the consumer's own handler, so it
                // keeps owning the model (and its units).
                rest.onChange?.({ target: { value: event.target.value } } as never);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
              }}
              className="w-16 shrink-0"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Field label={label} hint={hint}>
      {input}
      {track}
    </Field>
  );
});
