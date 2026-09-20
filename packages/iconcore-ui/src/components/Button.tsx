import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  // Flat accent fill (A6): the former accent gradient topped out lighter than
  // `--ic-accent`, so white text on primary never reached 4.5:1. Flat fill +
  // themed hover keeps contrast AA in both themes.
  primary:
    'min-h-[var(--ic-control-lg)] gap-[7px] rounded-ic-lg border border-ic-accent-hover bg-ic-accent px-[14px] text-[0.78rem] font-[740] tracking-[0.02em] ' +
    'text-ic-on-accent hover:not-disabled:-translate-y-px hover:not-disabled:bg-ic-accent-hover',
  secondary: 'min-h-[var(--ic-control-md)] gap-2 rounded-ic-md border border-ic-border bg-ic-elevated px-3 text-[13px] text-ic-text hover:not-disabled:bg-ic-surface',
  ghost: 'min-h-[var(--ic-control-md)] gap-2 rounded-ic-md px-3 text-[13px] text-ic-text-muted hover:not-disabled:bg-ic-elevated hover:not-disabled:text-ic-text'
};

/**
 * Action button. Extends the native <button> semantics; `type` defaults to
 * "button" since these never submit.
 *
 * Ordering (004 §9.1): `type`/`disabled` are destructured out of props and
 * spread first as `{...rest}`, then written explicitly — so the safe default
 * is never clobbered by a stray `type` in the spread.
 *
 * Disabled buttons opt out of hover/transition entirely
 * (`hover:not-disabled:*`) and never translate.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'ghost', iconLeft, iconRight, type = 'button', disabled, children, ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center whitespace-nowrap font-medium transition-[background,color,transform,opacity] duration-150 outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-ic-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ic-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className
      )}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});