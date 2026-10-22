import { forwardRef, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface SplitButtonItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface SplitButtonBaseProps {
  /** Visible label of the primary control. */
  label: ReactNode;
  /** Optional leading glyph of the primary control. */
  icon?: ReactNode;
  items: SplitButtonItem[];
  /** Accessible name for the menu trigger; the visible glyph is a chevron only. */
  menuLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fully rounded ends, as used by the promo header. Default is the kit's rounded rect. */
  pill?: boolean;
  disabled?: boolean;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * The primary either performs an in-page action (`onAction`) or navigates (`actionHref`) —
 * never both, never neither. The union makes a dead primary unrepresentable, so a caller
 * that loses its handler fails typecheck instead of rendering a control that does nothing.
 *
 * `actionHref` renders the primary as an anchor, so middle-click and "open in new tab" keep
 * working. The download buttons point at the releases page, which is navigation, not an
 * in-page action.
 */
export type SplitButtonProps = SplitButtonBaseProps &
  ({ onAction: () => void; actionHref?: never } | { onAction?: never; actionHref: string });

const MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50';

const ALIGN: Record<'start' | 'end', string> = {
  start: 'start-0',
  end: 'end-0'
};

function ChevronDown() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6.5 8 10.5 12 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Action + menu in one control, built from `button` elements and a `role="menu"` list.
 * Behaviour follows the ARIA menu-button pattern: `aria-haspopup`/`aria-expanded` on the
 * trigger, focus moves into the menu, arrows/Home/End walk enabled items, Escape closes
 * and returns focus, and a pointer press outside closes without stealing focus. Passing
 * `actionHref` swaps the primary for a real anchor; the menu stays the same.
 *
 * The props union already forbids a primary with neither `onAction` nor `actionHref`. For a
 * JavaScript caller that gets there anyway, the primary is dropped and a dev warning names
 * the missing prop — an inert control that looks clickable is the one outcome to avoid.
 */
export const SplitButton = forwardRef<HTMLDivElement, SplitButtonProps>(function SplitButton(
  {
    label,
    icon,
    onAction,
    actionHref,
    items,
    menuLabel = 'Mais opções',
    variant = 'default',
    size = 'default',
    pill = false,
    disabled = false,
    align = 'end',
    className
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const initialFocus = useRef<'first' | 'last'>('first');

  const [open, setOpen] = useState(false);

  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const enabledItems = (): HTMLButtonElement[] =>
    itemRefs.current.filter((element): element is HTMLButtonElement =>
      Boolean(element && !element.disabled)
    );

  const showMenu = (focusTarget: 'first' | 'last') => {
    if (disabled || items.length === 0) return;

    initialFocus.current = focusTarget;
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const list = itemRefs.current.filter((element): element is HTMLButtonElement =>
      Boolean(element && !element.disabled)
    );
    const target = initialFocus.current === 'last' ? list[list.length - 1] : list[0];

    target?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close(false);
    };

    document.addEventListener('mousedown', onPointerDown);

    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  const select = (item: SplitButtonItem) => {
    if (item.disabled) return;

    item.onSelect();
    close(true);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === 'Tab') {
      close(false);
      return;
    }

    const list = enabledItems();
    if (list.length === 0) return;

    const current = list.indexOf(document.activeElement as HTMLButtonElement);

    const focusAt = (index: number) => {
      event.preventDefault();
      list[(index + list.length) % list.length].focus();
    };

    if (event.key === 'ArrowDown') focusAt(current + 1);
    else if (event.key === 'ArrowUp') focusAt(current - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(list.length - 1);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showMenu('first');
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      showMenu('last');
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    }
  };

  const primaryShape = pill ? 'rounded-s-full rounded-e-none' : 'rounded-e-none';
  const triggerShape = cn(
    'rounded-s-none px-2',
    pill ? 'rounded-e-full border-s border-primary-foreground/20' : 'border-s-0'
  );
  const asLink = Boolean(actionHref) && !disabled;
  // Unreachable through the props union; a JavaScript caller can still get here, and an
  // inert primary that looks clickable is worse than no primary at all.
  const deadPrimary = !actionHref && !onAction;

  useEffect(() => {
    if (deadPrimary && import.meta.env.DEV) {
      console.warn(
        'SplitButton: the primary needs either `onAction` or `actionHref`; dropping it and keeping the menu.'
      );
    }
  }, [deadPrimary]);

  return (
    <div
      ref={(element) => {
        wrapperRef.current = element;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      }}
      className={cn('relative inline-flex', className)}
    >
      {!deadPrimary &&
        (asLink ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ variant, size, className: primaryShape })}
          >
            {icon}
            {label}
          </a>
        ) : (
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={disabled}
            onClick={() => {
              close(false);
              onAction?.();
            }}
            className={primaryShape}
          >
            {icon}
            {label}
          </Button>
        ))}

      {items.length > 0 && (
        <Button
          ref={triggerRef}
          id={triggerId}
          type="button"
          variant={variant}
          size={size}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={menuLabel}
          onClick={() => (open ? close(true) : showMenu('first'))}
          onKeyDown={onTriggerKeyDown}
          className={triggerShape}
        >
          <ChevronDown />
        </Button>
      )}

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute top-full z-50 mt-1 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-float',
            ALIGN[align]
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => select(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(item);
                }
              }}
              className={cn(MENU_ITEM, item.danger && 'text-destructive')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
