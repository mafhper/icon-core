import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

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
  { icon, label, onSelect, className },
  ref
) {
  return (
    <MenuPrimitive.Item
      ref={ref}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-ic-sm px-2 py-1.5 text-[13px] text-ic-text outline-none select-none',
        'data-[highlighted]:bg-ic-elevated',
        className
      )}
    >
      {icon != null && <span className="flex shrink-0 items-center text-ic-text-muted">{icon}</span>}
      <span>{label}</span>
    </MenuPrimitive.Item>
  );
});
