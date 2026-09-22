import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

/**
 * jsdom reports no client rects, which would leave the trap with an empty
 * focusable list (it then falls back to the container). The wrap tests need the
 * controls to count as rendered, so the rect list is faked for this file only.
 */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{} as DOMRect, {} as DOMRect] as unknown as DOMRectList);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const Dialog = ({ open }: { open: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label="Test dialog">
      <button type="button">first</button>
      <button type="button">last</button>
    </div>
  );
};

describe('useFocusTrap', () => {
  it('moves focus to the first control on open and restores it on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<Dialog open />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();

    rerender(<Dialog open={false} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('wraps Tab from the last control back to the first', () => {
    render(<Dialog open />);
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Dialog open />);
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});
