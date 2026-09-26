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
  /**
   * EX5 replaced the target checkbox list + global format with an editable plan.
   * The names the old test guarded (a "quick select" combobox) no longer exist —
   * these cover what replaced them. A project must be open for the plan to seed.
   */
  const renderExport = () => {
    localStorage.setItem(
      'iconcore-composer-project',
      JSON.stringify({
        schemaVersion: 3,
        metadata: { name: 'A11y', shortName: 'A11y' },
        canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
        layers: [],
        variants: { default: {} },
        targets: [{ target: 'tauri', enabled: true }],
        exportProfile: { outputBaseName: 'a11y', quality: 0.95, generateReport: false }
      })
    );
    renderInApp(<ExportView />);
  };

  afterEach(() => {
    localStorage.removeItem('iconcore-composer-project');
  });

  it('names the preset picker and every artifact toggle', () => {
    renderExport();

    expect(screen.getByRole('group', { name: 'Export presets' })).toBeInTheDocument();
    // The Tauri target seeds real containers — the regression IC15 exists for.
    const toggles = screen.getAllByRole('checkbox', { name: /^Include / });
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((toggle) => {
      expect(toggle).toHaveAccessibleName();
    });
  });

  it('names each row action by the artifact it acts on', () => {
    renderExport();

    expect(screen.getAllByRole('button', { name: /^Edit / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Duplicate / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Remove / }).length).toBeGreaterThan(0);
  });

  it('exposes the destination as a named group and labels the export action', () => {
    renderExport();

    // The FieldGroup and the SegmentedControl must not share a name, or a screen
    // reader announces "Destination" twice.
    expect(screen.getByRole('group', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Delivery destination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export ZIP|Export to folder|Download/ })).toBeInTheDocument();
  });

  it('explains the empty state instead of rendering a broken plan', () => {
    localStorage.clear();
    renderInApp(<ExportView />);

    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument();
  });
});
