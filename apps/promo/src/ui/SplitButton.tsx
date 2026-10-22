import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

export interface SplitButtonItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface SplitButtonProps {
  /** Visible label of the primary action. */
  label: string;
  onAction: () => void;
  items: SplitButtonItem[];
  /** Accessible name for the menu trigger; the visible glyph is a chevron only. */
  menuLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  align?: 'start' | 'end';
  className?: string;
}

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
 * and returns focus, and a pointer press outside closes without stealing focus.
 */
export const SplitButton = forwardRef<HTMLDivElement, SplitButtonProps>(function SplitButton(
  {
    label,
    onAction,
    items,
    menuLabel = 'Mais opções',
    variant = 'default',
    size = 'default',
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

  return (
    <div
      ref={(element) => {
        wrapperRef.current = element;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      }}
      className={cn('relative inline-flex', className)}
    >
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => {
          close(false);
          onAction();
        }}
        className="rounded-e-none"
      >
        {label}
      </Button>

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
          className="rounded-s-none border-s-0 px-2"
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
