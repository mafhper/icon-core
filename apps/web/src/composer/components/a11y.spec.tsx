import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { ToastProvider } from '../toast/ToastContext';
import { ComposerProvider } from '../ComposerContext';
import { CommandPalette } from './CommandPalette';
import { ExportView } from '../views/ExportView';

afterEach(cleanup);

/** `ComposerProvider` reads `useToast`, so the toast provider must wrap it. */
const renderInApp = (node: ReactNode) =>
  render(
    <ToastProvider>
      <ComposerProvider>{node}</ComposerProvider>
    </ToastProvider>
  );

describe('CommandPalette (accessible name + modal focus)', () => {
  it('opens as a named modal focused on the search field, and closes on Escape', () => {
    renderInApp(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    // The search input is named without relying on the placeholder.
    expect(screen.getByLabelText('Search commands')).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ExportView (accessible names)', () => {
  it('names the quick-select target picker', () => {
    renderInApp(<ExportView />);
    expect(screen.getByRole('combobox', { name: 'Quick select targets' })).toBeInTheDocument();
  });
});
