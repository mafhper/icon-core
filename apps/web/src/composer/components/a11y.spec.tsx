import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { TooltipProvider } from '@iconcore/ui';
import { ToastProvider } from '../toast/ToastContext';
import { ComposerProvider, useComposer } from '../ComposerContext';
import { CommandPalette } from './CommandPalette';
import type { IconCoreProject } from '@iconcore/shared';
import { createBlankProject } from '../utils/projectFactory';
import { StudioShell } from '../../studio/StudioApp';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }
});

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

describe('Studio export panel (accessible names)', () => {
  /**
   * Export lives at the end of the Inspector Export tab — the dialog left with
   * the P2 cut, and the panel keeps the same contract the dialog held: every
   * group named, every toggle named, the export action labelled with its file
   * count.
   */
  const SeededShell = ({ project }: { project: IconCoreProject }) => {
    const { dispatch } = useComposer();
    useEffect(() => {
      dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
    }, [dispatch, project]);
    return <StudioShell />;
  };

  const openExport = () => {
    render(
      <TooltipProvider delayDuration={400}>
        <ToastProvider>
          <ComposerProvider>
            <SeededShell project={createBlankProject('A11y', 512)} />
          </ComposerProvider>
        </ToastProvider>
      </TooltipProvider>
    );
    // The export surface is the Inspector Export tab itself.
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Export' }));
    return inspector;
  };

  it('names the format, size and variant groups and every toggle', () => {
    const inspector = openExport();

    for (const name of ['File format', 'PNG sizes', 'Variants']) {
      expect(within(inspector).getByRole('group', { name })).toBeInTheDocument();
    }
    for (const name of ['SVG', 'PNG', 'ICO']) {
      expect(within(inspector).getByRole('checkbox', { name })).toHaveAccessibleName();
    }
  });

  it('labels the export action with its file count', () => {
    const inspector = openExport();

    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
  });
});
