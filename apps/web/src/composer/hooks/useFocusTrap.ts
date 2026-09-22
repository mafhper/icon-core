import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const focusableWithin = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // `getClientRects()` is empty for display:none/`visibility:hidden` nodes and
    // — unlike `offsetParent` — still reports position:fixed containers.
    (element) => element.getClientRects().length > 0
  );

/**
 * Ref-counted so nested dialogs (palette over the welcome modal) do not clear
 * the background's `inert` when only the inner one closes.
 */
let inertRootCount = 0;

/**
 * Keeps Tab inside `containerRef` while `active`: focus moves in on open (to
 * `initialFocusRef`, else the first focusable, else the container) and returns
 * to the previously focused element on close (better-accessibility: modals move
 * focus in, keep it there and restore it to the trigger).
 *
 * The container must be focusable (`tabIndex={-1}`) as the last-resort target.
 *
 * While active, `#root` is marked `inert`, so the background is removed from the
 * tab order and the accessibility tree. Every dialog is portalled to `<body>`,
 * which keeps the dialog itself (and popovers it portals, such as the colour
 * picker) outside the inert subtree.
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>
): void => {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocusRef?.current ?? focusableWithin(container)[0] ?? container).focus();

    const root = document.getElementById('root');
    inertRootCount += 1;
    if (inertRootCount === 1) root?.setAttribute('inert', '');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusableWithin(container);
      if (items.length === 0) {
        // Nothing tabbable inside: keep focus on the container.
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && container.contains(current);
      if (event.shiftKey && (!inside || current === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      inertRootCount -= 1;
      if (inertRootCount === 0) root?.removeAttribute('inert');
      previous?.focus();
    };
  }, [active, containerRef, initialFocusRef]);
};
