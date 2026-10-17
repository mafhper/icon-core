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
 * Two scrolls deliberately do NOT dismiss: a scroll in a container that does
 * not hold the anchor (it cannot move the panel's target), and the opening
 * interaction's own scroll — browsers deliver scroll events a frame or two
 * late, so the trigger's focus-scroll can land after the panel opens and
 * must not dismiss what it just opened. Anything that really moves the
 * anchor still dismisses.
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

    // Scroll-offset snapshot taken when the dismissal listeners attach. It
    // recognises the opening interaction's own scroll: Chromium delivers
    // scroll events asynchronously (a frame or two after the physical
    // scroll), so a scroll that finished just before the panel opened —
    // the trigger's click focus-scroll, a scroll-into-view of the trigger —
    // can land AFTER this listener attaches and would dismiss a panel that
    // just opened. Such a stale event reports the same offsets recorded
    // here and is ignored; a genuine later scroll changes an offset and
    // still dismisses.
    interface Offset {
      top: number;
      left: number;
    }
    const baseline = new Map<Element | Document, Offset>();
    baseline.set(document, { top: window.scrollY, left: window.scrollX });
    let ancestor: Element | null = anchorRef.current;
    while (ancestor) {
      if (ancestor.scrollHeight > ancestor.clientHeight || ancestor.scrollWidth > ancestor.clientWidth) {
        baseline.set(ancestor, { top: ancestor.scrollTop, left: ancestor.scrollLeft });
      }
      ancestor = ancestor.parentElement;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onResize = () => onClose();
    const onScroll = (event: Event) => {
      const target = event.target;
      // A scroll in a container that cannot move the anchor cannot detach
      // the fixed panel: ignore it instead of dismissing (e.g. another
      // sidebar column scrolling while a popover floats over this one).
      // A viewport (document) scroll moves everything and still dismisses.
      if (target !== document && target !== window) {
        if (!(target instanceof Element) || !target.contains(anchorRef.current)) return;
      }
      const known = target === window ? baseline.get(document) : baseline.get(target as Element | Document);
      const current: Offset | null =
        target === window || target === document
          ? { top: window.scrollY, left: window.scrollX }
          : target instanceof Element
            ? { top: target.scrollTop, left: target.scrollLeft }
            : null;
      // Same offsets as at open: the opening interaction's own scroll,
      // delivered late. Not a viewport change — keep the panel open.
      if (known && current && known.top === current.top && known.left === current.left) return;
      onClose();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
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
