import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { type ComponentProps, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

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
