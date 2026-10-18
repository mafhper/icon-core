import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../../composer/ComposerContext';
import { modKey } from '../../composer/utils/platform';
import { ToastProvider } from '../../composer/toast/ToastContext';
import { createBlankProject } from '../../composer/utils/projectFactory';
import { StudioShell } from '../StudioApp';

afterEach(() => {
  cleanup();
  delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  document.documentElement.removeAttribute('data-tauri');
});

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-tauri');
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

/** Opens the collector: Radix dropdowns open on pointer-down, not on click. */
const openMenu = () => {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Menu' }));
  return screen.getByRole('menu', { name: 'Menu' });
};

describe('Studio titlebar — minimal bar, collector menu, elastic breadcrumb, window controls', () => {
  it('lays out the four zones left to right: brand, collector, breadcrumb, window controls', () => {
    renderShell(<SeededShell project={createBlankProject('Zones', 512)} />);
    const banner = screen.getByRole('banner');

    const brand = within(banner).getByRole('button', { name: 'Go to workspaces' });
    // F1: logo + title, never truncated (flex: 0 0 auto in the stylesheet).
    expect(brand).toHaveTextContent('Icon-Core');
    expect(brand).toHaveTextContent('BETA');

    // F2: the single collector trigger — hamburger + "Menu", 26px, no ⋯.
    const trigger = within(banner).getByRole('button', { name: 'Menu' });
    expect(trigger.querySelector('svg.lucide-menu')).not.toBeNull();
    expect(banner.querySelector('svg.lucide-more-horizontal')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // F3: the breadcrumb is status, not navigation.
    const doc = banner.querySelector('.studio-doc');
    expect(doc).not.toBeNull();
    expect(doc).toHaveAttribute('aria-live', 'polite');
    expect(doc).not.toHaveAttribute('tabindex');

    // F4: the window controls zone closes the bar (Tauri-only, hidden by CSS).
    const controls = banner.querySelector('.studio-window-controls');
    expect(controls).not.toBeNull();

    const zones = Array.from(banner.children);
    expect(zones).toHaveLength(4);
    expect(zones[0]).toBe(brand);
    expect(zones[1]).toBe(trigger);
    expect(zones[2]).toBe(doc);
    expect(zones[3]).toBe(controls);
  });

  it('holds the nine actions in three separator-bound groups, with the same labels, icons and shortcuts', () => {
    renderShell(<SeededShell project={createBlankProject('Collector', 512)} />);
    const menu = openMenu();

    // No measured fold exists anymore: no trigger of overflow anywhere.
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();

    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(9);
    // Reading order, three groups, two separators between them.
    expect(items.map((item) => item.textContent)).toEqual([
      'New document',
      'Rename document',
      'Close document',
      `Save session${modKey()}+S`,
      `Export icons${modKey()}+E`,
      'Switch to light theme',
      'Keyboard shortcuts?',
      'Preferences',
      'About Icon-Core'
    ]);
    expect(within(menu).getAllByRole('separator')).toHaveLength(2);

    // Labels keep the glyphs the bar buttons had.
    expect(items[0].querySelector('svg.lucide-file-plus')).not.toBeNull();
    expect(items[1].querySelector('svg.lucide-pen-line')).not.toBeNull();
    expect(items[2].querySelector('svg.lucide-file-x-2')).not.toBeNull();
    expect(items[3].querySelector('svg.lucide-save')).not.toBeNull();
    expect(items[4].querySelector('svg.lucide-download')).not.toBeNull();
    // System resolves dark here, so the theme row names the flip to light.
    expect(items[5].querySelector('svg.lucide-sun')).not.toBeNull();
    expect(items[6].querySelector('svg.lucide-keyboard')).not.toBeNull();
  });

  it('closes the collector on Escape and gives the focus back to the trigger', async () => {
    renderShell(<SeededShell project={createBlankProject('Escape', 512)} />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    const menu = openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'About Icon-Core' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Menu' })).not.toBeInTheDocument();
    // Radix restores the focus when the content unmounts, which is after the
    // close animation frame — the same as in the browser.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('preserves disabled actions as aria-disabled, never as DOM disabled', () => {
    // No seeded project: the welcome is over the shell, and the document half
    // of the collector is honest about having nothing to act on.
    renderShell(<StudioShell />);
    const menu = openMenu();

    for (const name of ['Rename document', 'Close document', /Save session/, /Export icons/]) {
      const item = within(menu).getByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).not.toHaveAttribute('disabled');
    }
    for (const name of ['New document', /Keyboard shortcuts/, 'Preferences', 'About Icon-Core']) {
      expect(within(menu).getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('switches the theme from the collector row; system stays a Preferences choice', () => {
    renderShell(<SeededShell project={createBlankProject('Theme', 512)} />);

    // System is the stored default and resolves dark here, so the row offers
    // the flip to light — and `system` is nowhere in the menu.
    const first = openMenu();
    expect(within(first).queryByRole('menuitem', { name: /System theme/ })).not.toBeInTheDocument();
    fireEvent.click(within(first).getByRole('menuitem', { name: 'Switch to light theme' }));

    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const second = openMenu();
    expect(within(second).getByRole('menuitem', { name: 'Switch to dark theme' })).toBeInTheDocument();
    fireEvent.click(within(second).getByRole('menuitem', { name: 'Switch to dark theme' }));

    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('renders the window controls in Windows order and never disables them', () => {
    // No document at all — and the controls are still enabled: a window can
    // always be minimized or closed. (The welcome also paints a `<header>`,
    // so the zone is addressed by its own class, not through the banner role.)
    renderShell(<StudioShell />);
    const zone = document.querySelector('.studio-window-controls') as HTMLElement;

    const buttons = within(zone).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Minimize',
      'Maximize',
      'Close window'
    ]);
    for (const button of buttons) {
      expect(button).toBeEnabled();
    }
    // The close half carries the OS red hover hook.
    expect(buttons[2].className).toContain('studio-window-close');
  });

  it('drives the Tauri window through the desktop API and marks the drag region', async () => {
    const calls: string[] = [];
    let maximized = false;
    const fake = {
      minimize: () => {
        calls.push('minimize');
        return Promise.resolve();
      },
      toggleMaximize: () => {
        calls.push('toggleMaximize');
        maximized = !maximized;
        return Promise.resolve();
      },
      close: () => {
        calls.push('close');
        return Promise.resolve();
      },
      isMaximized: () => Promise.resolve(maximized),
      onResized: () => Promise.resolve(() => undefined)
    };
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = {
      core: {},
      window: { getCurrentWindow: () => fake }
    };

    renderShell(<SeededShell project={createBlankProject('Window', 512)} />);
    const banner = screen.getByRole('banner');
    expect(document.documentElement).toHaveAttribute('data-tauri');
    // Dragging belongs to the shell chrome: `deep` so the background and the
    // breadcrumb drag, while every clickable child blocks it.
    expect(banner).toHaveAttribute('data-tauri-drag-region', 'deep');

    fireEvent.click(within(banner).getByRole('button', { name: 'Minimize' }));
    fireEvent.click(within(banner).getByRole('button', { name: 'Maximize' }));
    await waitFor(() =>
      expect(within(banner).getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    );
    fireEvent.click(within(banner).getByRole('button', { name: 'Close window' }));

    expect(calls).toEqual(['minimize', 'toggleMaximize', 'close']);
  });
});
