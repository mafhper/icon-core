import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { type ComponentProps, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { withIconStroke } from '../utils/icon';

/**
 * Horizontal menu bar with desktop menu-bar behavior: triggers sit side by
 * side, arrow keys move across them, and while a menu is open a pointer
 * crossing the bar switches menus. Escape closes and returns focus to the
 * trigger; `MenubarContent` is portaled.
 *
 * **A `MenubarContent` takes menubar primitives, not `Menu`'s.** Radix threads
 * its menu contexts through a scope created per package instance, and
 * `@radix-ui/react-menubar` does not share it with
 * `@radix-ui/react-dropdown-menu`: a `MenuItem` rendered inside a
 * `MenubarContent` throws `MenuItem must be used within Menu`. That is also
 * why the two packages must stay on the same `@radix-ui/react-menu` release
 * wave — bump them together, never this one alone.
 *
 * Like `Menu`, this is presentation only: the consumer owns the trigger text
 * and the content.
 */

export interface MenubarProps {
  children: ReactNode;
  /** Accessible name for the bar (e.g. "Main menu"). */
  'aria-label'?: string;
  className?: string;
}

export const Menubar = ({ children, className, 'aria-label': ariaLabel }: MenubarProps) => (
  <MenubarPrimitive.Root
    aria-label={ariaLabel}
    className={cn('flex items-center select-none', className)}
  >
    {children}
  </MenubarPrimitive.Root>
);

/**
 * One menu slot. The trigger and its content must live inside the same
 * `MenubarMenu` — Radix's contract: the slot owns the open state and the
 * trigger↔content pairing (ARIA wiring, close-on-select, roving focus).
 */
export type MenubarMenuProps = ComponentProps<typeof MenubarPrimitive.Menu>;
export const MenubarMenu = MenubarPrimitive.Menu;

export interface MenubarTriggerProps {
  children: ReactNode;
  className?: string;
}

export const MenubarTrigger = forwardRef<HTMLButtonElement, MenubarTriggerProps>(
  function MenubarTrigger({ children, className }, ref) {
    return (
      <MenubarPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex h-[26px] cursor-pointer items-center gap-1.5 rounded-ic-sm px-2.5 text-[13px] text-ic-text outline-none select-none',
          'hover:bg-ic-elevated data-[highlighted]:bg-ic-elevated data-[state=open]:bg-ic-elevated',
          className
        )}
      >
        {children}
      </MenubarPrimitive.Trigger>
    );
  }
);

export interface MenubarContentProps {
  children: ReactNode;
  className?: string;
  /** Panel alignment against the trigger. */
  align?: 'start' | 'center' | 'end';
  /** Gap between trigger and panel, in px. */
  sideOffset?: number;
}

export const MenubarContent = ({ children, className, align = 'start', sideOffset = 6 }: MenubarContentProps) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-44 rounded-ic-md border border-ic-border bg-ic-overlay p-1 shadow-xl',
        className
      )}
    >
      {children}
    </MenubarPrimitive.Content>
  </MenubarPrimitive.Portal>
);

export interface MenubarItemProps {
  /** Leading glyph. */
  icon?: ReactNode;
  /** Visible item label. */
  label: string;
  /**
   * Keyboard shortcut, right-aligned. **Display only** — it does not bind.
   * A label that lies about a shortcut is worse than no label, so the app that
   * shows one owns the binding; `MenubarItem` never installs a listener.
   */
  shortcut?: string;
  /**
   * Dimmed and unselectable.
   *
   * The Radix item keeps focusability (`aria-disabled`, not `disabled`) so arrow
   * keys still land on it and a screen reader can read *why*. That is why this is
   * not the DOM `disabled`: a disabled node is skipped silently, and "Edit Path
   * arrives in a later phase" is information the person needs.
   */
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
}

/**
 * The menubar twin of `Menu`'s item — same behavior and same presentation. It
 * exists because a `MenubarContent` only accepts menubar primitives (see the
 * scope note at the top of this file), not because it behaves differently.
 */
export const MenubarItem = forwardRef<HTMLDivElement, MenubarItemProps>(function MenubarItem(
  { icon, label, shortcut, disabled = false, onSelect, className },
  ref
) {
  return (
    <MenubarPrimitive.Item
      ref={ref}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-ic-sm px-2 py-1.5 text-[13px] text-ic-text outline-none select-none',
        'data-[highlighted]:bg-ic-elevated',
        // `aria-disabled` keeps the row focusable, so the dim has to be explicit
        // rather than inherited from Radix's `data-disabled`.
        'data-[disabled]:cursor-default data-[disabled]:text-ic-text-muted data-[disabled]:opacity-55',
        className
      )}
    >
      {icon != null && <span className="flex shrink-0 items-center text-ic-text-muted">{withIconStroke(icon)}</span>}
      <span className="truncate">{label}</span>
      {shortcut != null && (
        <span className="ml-auto pl-4 text-[11px] tracking-tight text-ic-text-muted tabular-nums">
          {shortcut}
        </span>
      )}
    </MenubarPrimitive.Item>
  );
});

export interface MenubarLabelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Non-interactive heading for a group of menubar items — the menubar twin of
 * `MenuLabel`.
 *
 * Deliberately a Radix `Label`, not a dimmed item: labels are not collection
 * items, so arrows, typeahead and `aria-activedescendant` skip it — a heading
 * focus can land on is a trap, and a heading that can be "selected" is a lie.
 * The colour rides the `--ic-text-muted` on `--ic-overlay` pair measured by
 * `scripts/check-ui-contrast.mjs`.
 */
export const MenubarLabel = ({ children, className }: MenubarLabelProps) => (
  <MenubarPrimitive.Label className={cn('px-2 pt-1.5 pb-1 text-[11px] text-ic-text-muted select-none', className)}>
    {children}
  </MenubarPrimitive.Label>
);

export interface MenubarRadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Mutually exclusive set of menubar items (e.g. the light/dark/system theme
 * choice) — the menubar twin of `MenuRadioGroup`.
 *
 * Controlled only: the checked item is `value`, and a selection reports
 * through `onValueChange` — the same shape as `SegmentedControl`, because it
 * is the same kind of setting expressed in a menu.
 */
export const MenubarRadioGroup = ({ value, onValueChange, children, className }: MenubarRadioGroupProps) => (
  <MenubarPrimitive.RadioGroup value={value} onValueChange={onValueChange} className={className}>
    {children}
  </MenubarPrimitive.RadioGroup>
);

export interface MenubarRadioItemProps {
  /** This option's identity inside the group. */
  value: string;
  /** Visible label and accessible name of the option. */
  label: string;
  /** Dimmed but still focusable — see `MenubarItemProps.disabled`. */
  disabled?: boolean;
  className?: string;
}

/**
 * One option of a `MenubarRadioGroup` — the menubar twin of `MenuRadioItem`.
 * The dot is the group's own affordance, so there is no leading-icon slot;
 * `label` is the visible text and the item's accessible name (Radix renders
 * it `aria-checked`).
 *
 * `disabled` keeps the row focusable for the same reason as `MenubarItem`:
 * arrows still land on it and a screen reader can read *why* it is unavailable.
 */
export const MenubarRadioItem = ({ value, label, disabled = false, className }: MenubarRadioItemProps) => (
  <MenubarPrimitive.RadioItem
    value={value}
    disabled={disabled}
    className={cn(
      'relative flex cursor-pointer items-center rounded-ic-sm py-1.5 pr-2 pl-7 text-[13px] text-ic-text outline-none select-none',
      'data-[highlighted]:bg-ic-elevated',
      'data-[disabled]:cursor-default data-[disabled]:text-ic-text-muted data-[disabled]:opacity-55',
      className
    )}
  >
    <span className="absolute left-2 flex h-3 w-3 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <span className="block h-1.5 w-1.5 rounded-full bg-ic-accent" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    <span className="truncate">{label}</span>
  </MenubarPrimitive.RadioItem>
);

/**
 * Divider between groups of menubar items — the menubar twin of
 * `MenuSeparator`.
 *
 * `role="separator"` is what a screen reader announces when arrowing across
 * it; a styled `<hr>` with the same visual would be silent about the grouping.
 */
export const MenubarSeparator = ({ className }: { className?: string }) => (
  <MenubarPrimitive.Separator className={cn('my-1 h-px bg-ic-border', className)} />
);
