import { type ReactNode, forwardRef, useState } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import type { TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Field label. Sentence case above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
  /** Unit shown inside the field, right of the number (e.g. `%`, `°`). */
  unit?: ReactNode;
}

/**
 * Panel field: flat filled surface, no visible border until focus. Tabular
 * numerals keep X/Y/size columns stable while typing; native spinners are hidden
 * so compact rows stay aligned.
 */
const fieldClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated bg-none px-2 py-0 ' +
  'text-[0.75rem] text-ic-text outline-none ' +
  'hover:bg-ic-overlay focus:border-ic-accent tabular-nums';

const bareInputClasses =
  'min-w-0 w-full rounded-none bg-transparent p-0 text-right tabular-nums text-[length:var(--ic-control-font-size)] outline-none ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]';

const isNumeric = (raw: string): boolean => raw.trim() !== '' && Number.isFinite(Number(raw));

/**
 * Labelled numeric input. Compound of `Field` + native `<input type="number">`.
 * With `unit`, the number and the unit share one field (`[ 100 % ]`).
 *
 * The field keeps a **text draft** while typing: clearing it (or typing just `-`)
 * no longer writes `0` to the model, which used to make the value jump the moment
 * the user selected-all and deleted. The model only receives parseable numbers,
 * and an abandoned draft falls back to the model value on blur/Enter.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { className, label, hint, variant = 'field', unit, value, onChange, onBlur, onKeyDown, ...rest },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === undefined || value === null ? '' : String(value));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
    if (isNumeric(event.target.value)) onChange?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setDraft(null);
    onBlur?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') setDraft(null);
    onKeyDown?.(event);
  };

  const shared = {
    // Only drive the DOM when the consumer controls the field: with
    // `defaultValue` the input must stay uncontrolled (otherwise it renders empty).
    ...(value === undefined || value === null ? {} : { value: display }),
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    ...rest
  };

  const control =
    unit != null ? (
      <span
        className={cn(
          'flex h-[var(--ic-control-md)] w-full items-center gap-0.5 rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2',
          'text-[0.75rem] text-ic-text hover:bg-ic-overlay focus-within:border-ic-accent',
          className
        )}
      >
        <input ref={ref} type="number" aria-label={label} className={bareInputClasses} {...shared} />
        <span className="select-none text-[0.6875rem] text-ic-text-muted">{unit}</span>
      </span>
    ) : (
      <input
        ref={ref}
        type="number"
        aria-label={variant === 'inline' ? label : undefined}
        className={cn(fieldClasses, className)}
        {...shared}
      />
    );

  if (variant === 'inline') return control;

  return (
    <Field label={label} hint={hint}>
      {control}
    </Field>
  );
});
