import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export type IconButtonVariant = 'default' | 'rail';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon node. Consumers bring their own icon library; this kit never imports one. */
  icon: ReactNode;
  /** Semantic name for the action. Required: tooltips are never the only label. */
  'aria-label': string;
  /** Toggle state — sets `aria-pressed` and the selected visuals. */
  selected?: boolean;
  variant?: IconButtonVariant;
}

const baseClasses =
  'inline-flex shrink-0 cursor-pointer items-center justify-center outline-none select-none transition-colors duration-150 ' +
  'focus-visible:ring-2 focus-visible:ring-ic-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ic-bg ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

const variantClasses: Record<IconButtonVariant, string> = {
  // Contextual bar/toggle button: inherits the surface text color (like the
  // pre-A2 inline buttons) and tints accent-soft when toggled on. Hover is
  // suppressed while selected so the accent tint is not overridden (the
  // pre-A2 buttons only carried the hover class when off).
  default:
    'h-[var(--ic-control-md)] w-[var(--ic-control-md)] rounded-ic-md text-ic-text ' +
    'not-data-[selected=true]:hover:not-disabled:bg-ic-elevated ' +
    'data-[selected=true]:bg-ic-accent-soft data-[selected=true]:text-ic-accent',
  // Vertical rail tool: muted by default, goes full text on hover and inverts
  // to the solid accent when active.
  rail:
    'h-[var(--ic-control-sm)] w-[var(--ic-control-sm)] rounded-ic-sm text-ic-text-muted ' +
    'hover:not-disabled:bg-ic-elevated hover:not-disabled:text-ic-text ' +
    'data-[selected=true]:bg-ic-accent data-[selected=true]:text-ic-on-accent'
};

/**
 * Square icon-only action button. Pairs with a Tooltip for visible labels and
 * an explicit `aria-label`: the icon is decorative and never the only label.
 *
 * `selected` is a controlled toggle (rail tools, panel toggles, grid/snap):
 * it renders `aria-pressed` and the selected token visuals. Set, not bound.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, icon, selected, variant = 'default', type = 'button', disabled, ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      aria-pressed={selected !== undefined ? selected : undefined}
      data-selected={selected !== undefined ? selected : undefined}
      className={cn(baseClasses, variantClasses[variant], className)}
    >
      {icon}
    </button>
  );
});