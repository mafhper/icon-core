import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { withIconStroke } from '../utils/icon';

export interface MenuProps {
  /** Trigger element (typically an `IconButton` with its own `aria-label`). */
  trigger: ReactNode;
  /** Accessible name for the menu itself. */
  label: string;
  children: ReactNode;
  className?: string;
}

export interface MenuItemProps {
  /** Leading glyph. */
  icon?: ReactNode;
  /** Visible item label. */
  label: string;
  /**
   * Keyboard shortcut, right-aligned. **Display only** — it does not bind.
   * A label that lies about a shortcut is worse than no label, so the app that
   * shows one owns the binding; `Menu` never installs a listener.
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
 * Dropdown menu for grouping mutually-exclusive creation/selection actions
 * (e.g. the shape picker in the canvas toolbar).
 *
 * Non-modal: the surrounding UI stays interactive while open; Escape and
 * outside pointer-down dismiss. Keyboard (arrows/Enter/typeahead) comes free
 * from Radix. The trigger is consumer-owned so it keeps its own `aria-label`;
 * tooltips do not compose over menu triggers (Radix `asChild` needs a DOM
 * node), so the open menu — with full text labels — is the affordance.
 */
export const Menu = ({ trigger, label, children, className }: MenuProps) => {
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          aria-label={label}
          sideOffset={6}
          className={cn(
            'z-50 min-w-44 rounded-ic-md border border-ic-border bg-ic-overlay p-1 shadow-xl',
            className
          )}
        >
          {children}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
};

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { icon, label, shortcut, disabled = false, onSelect, className },
  ref
) {
  return (
    <MenuPrimitive.Item
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
    </MenuPrimitive.Item>
  );
});

/**
 * Divider between groups of items.
 *
 * `role="separator"` is what a screen reader announces when arrowing across it;
 * a styled `<hr>` with the visual would be silent about the grouping.
 */
export const MenuSeparator = ({ className }: { className?: string }) => (
  <MenuPrimitive.Separator
    className={cn('my-1 h-px bg-ic-border', className)}
  />
);
