import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

export interface PopoverProps {
  open: boolean;
  /** Element the panel is anchored to (usually the trigger button). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Called for every dismissal path: outside click, Escape, viewport change. */
  onClose: () => void;
  children: ReactNode;
  /** Panel width in px — used to clamp the panel inside the viewport. */
  width?: number;
  /** Approximate panel height in px — used to flip the panel above the anchor. */
  estimatedHeight?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Anchored popover, portaled to `<body>`.
 *
 * The inspector is a narrow, scrollable column: a panel rendered inline would be
 * clipped by `overflow-x/y`, so every contextual surface (colour picker, fill
 * actions, menus) must portal out. This primitive owns the parts that are easy to
 * get wrong — viewport clamping, flipping above when there is no room below,
 * outside-click/Escape dismissal, and closing on scroll/resize (the panel is
 * positioned with fixed coordinates, so a scroll would detach it).
 *
 * It deliberately does **not** touch document state: dismissal only reports
 * `onClose`, and the consumer decides what to commit.
 */
export const Popover = ({
  open,
  anchorRef,
  onClose,
  children,
  width = 300,
  estimatedHeight = 340,
  className,
  'aria-label': ariaLabel
}: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.right - width),
        Math.max(8, window.innerWidth - width - 8)
      );
      const below = rect.bottom + 6;
      const top = below + estimatedHeight > window.innerHeight
        ? Math.max(8, rect.top - estimatedHeight - 6)
        : below;
      setPosition({ left, top });
    };

    place();
  }, [open, anchorRef, width, estimatedHeight]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onViewportChange = () => onClose();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      style={{ position: 'fixed', left: position.left, top: position.top, width }}
      className={cn('z-50 rounded-ic-md border border-ic-border bg-ic-overlay p-3 shadow-xl', className)}
    >
      {children}
    </div>,
    document.body
  );
};
