import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../../composer/ComposerContext';
import { ToastProvider } from '../../composer/toast/ToastContext';
import { createBlankProject } from '../../composer/utils/projectFactory';
import { StudioShell } from '../StudioApp';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
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

const SeededShell = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioShell />;
};

const renderShell = (node: ReactNode) => {
  // The provider reads the hash on mount: with an empty one it normalizes to
  // `workspaces` and the welcome (`aria-modal`) mounts over the shell. An open
  // document, which is where the titlebar actions live, is `#/edit-space`.
  window.location.hash = '#/edit-space';
  return render(
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>{node}</ComposerProvider>
      </ToastProvider>
    </TooltipProvider>
  );
};

/** Turns pixels into "how many actions fit": the bar's own content model. */
const ACTION_WIDTH = 68;
const OVERFLOW_WIDTH = 34;
const BAR_CHROME = 260;

/**
 * jsdom computes no layout: `scrollWidth` and `clientWidth` are both 0, which is
 * exactly the "fits" reading. The bar's only input is that pair, so the spec
 * models it — each visible action has a width, the trigger has one too, and the
 * content is whatever is still in the bar. Folding an action therefore *frees*
 * width, which is the property the real bar has and a fixed stub would not.
 */
const fakeBarLayout = () => {
  const bar = screen.getByRole('banner');
  const layout = { clientWidth: 1000 };
  const contentWidth = () => {
    const actions = bar.querySelectorAll('[data-bar-action]').length;
    const trigger = bar.querySelector('[aria-label="More actions"]') ? OVERFLOW_WIDTH : 0;
    return BAR_CHROME + actions * ACTION_WIDTH + trigger;
  };
  Object.defineProperty(bar, 'clientWidth', { configurable: true, get: () => layout.clientWidth });
  Object.defineProperty(bar, 'scrollWidth', { configurable: true, get: contentWidth });
  return {
    bar,
    /** Resizes the bar and lets the measure → fold loop settle. */
    resize(clientWidth: number) {
      layout.clientWidth = clientWidth;
      fireEvent(window, new Event('resize'));
    }
  };
};

describe('Studio titlebar — distributed groups, measured overflow', () => {
  it('folds the tail of the priority into More actions and restores it when the room comes back', () => {
    renderShell(<SeededShell project={createBlankProject('Overflow', 512)} />);
    const layout = fakeBarLayout();

    // Nothing folded: every group is on the bar and there is no overflow menu.
    expect(screen.getByRole('button', { name: 'About Icon-Core' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();

    layout.resize(800);

    // About and Preferences are the tail: they leave first, and the trigger
    // that holds them appears.
    expect(screen.queryByRole('button', { name: 'About Icon-Core' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preferences' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
    // …and the head of the priority is still on the bar.
    expect(screen.getByRole('button', { name: 'Save session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export icons' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close document' })).toBeInTheDocument();
    // The trigger announces itself and its state (not "FilePlus", not "Main
    // menu"): More actions + aria-expanded.
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'false');

    // Room again: the bar takes its actions back and the trigger disappears.
    layout.resize(1200);
    expect(screen.getByRole('button', { name: 'About Icon-Core' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('keeps label, icon and shortcut identical when an action moves into the menu', () => {
    renderShell(<SeededShell project={createBlankProject('Overflow', 512)} />);
    const layout = fakeBarLayout();

    // The extreme: every action folds, so Export is in the menu too.
    layout.resize(300);
    expect(screen.queryByRole('button', { name: 'Export icons' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save session' })).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }));
    const menu = screen.getByRole('menu', { name: 'More actions' });

    // Ctrl+E is the correction that rides with this slice: the menu item shows
    // the same label and the same binding the bar button showed.
    const exportItem = within(menu).getByRole('menuitem', { name: /Export icons/ });
    expect(exportItem).toHaveTextContent('Ctrl+E');
    expect(exportItem.querySelector('svg.lucide-download')).not.toBeNull();

    const saveItem = within(menu).getByRole('menuitem', { name: /Save session/ });
    expect(saveItem).toHaveTextContent('Ctrl+S');
    expect(saveItem.querySelector('svg.lucide-save')).not.toBeNull();

    // The theme is a toggle, not a three-way menu: what folds is the one action
    // that flips the state in force (system resolves dark in this environment).
    expect(within(menu).getByRole('menuitem', { name: 'Switch to light theme' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'System theme' })).not.toBeInTheDocument();
  });

  it('sends the focus to More actions when the focused action is the one that folds', () => {
    renderShell(<SeededShell project={createBlankProject('Focus', 512)} />);
    const layout = fakeBarLayout();

    const about = screen.getByRole('button', { name: 'About Icon-Core' });
    about.focus();
    expect(about).toHaveFocus();

    layout.resize(800);

    // The focused control is gone; the trigger that now carries it holds focus.
    expect(screen.queryByRole('button', { name: 'About Icon-Core' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
  });

  it('closes the overflow menu on Escape and gives the focus back to the trigger', async () => {
    renderShell(<SeededShell project={createBlankProject('Escape', 512)} />);
    const layout = fakeBarLayout();
    layout.resize(800);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }));
    const menu = screen.getByRole('menu', { name: 'More actions' });
    expect(within(menu).getByRole('menuitem', { name: 'About Icon-Core' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'More actions' })).not.toBeInTheDocument();
    // Radix restores the focus when the content unmounts, which is after the
    // close animation frame — the same as in the browser.
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus());
  });

  it('never renders the trigger without an overflowed action', () => {
    renderShell(<SeededShell project={createBlankProject('Empty menu', 512)} />);

    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    // The bar itself is the full action set.
    for (const name of ['New document', 'Rename document', 'Close document', 'Save session', 'Export icons']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('disables Rename, Close and Save while there is no document', () => {
    // No seeded project: the welcome is over the shell, and the document half
    // of the bar is honest about having nothing to act on.
    renderShell(<StudioShell />);

    expect(screen.getByRole('button', { name: 'New document' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rename document' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close document' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save session' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export icons' })).toBeDisabled();
  });
});
