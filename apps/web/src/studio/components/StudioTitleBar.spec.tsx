import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../../composer/ComposerContext';
import { ToastProvider } from '../../composer/toast/ToastContext';
import { ToastViewport } from '../../composer/toast/ToastViewport';
import { modKey } from '../../composer/utils/platform';
import { createBlankProject } from '../../composer/utils/projectFactory';
import { FakeIDBFactory } from '../../test/fakeIndexedDb';
import { StudioShell } from '../StudioApp';

afterEach(() => {
  cleanup();
  delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  delete (window as unknown as { indexedDB?: unknown }).indexedDB;
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

/** The provider takes IndexedDB when it exists; the fake makes the list real. */
const useStore = (): FakeIDBFactory => {
  const factory = new FakeIDBFactory();
  (window as unknown as { indexedDB?: unknown }).indexedDB = factory;
  return factory;
};

const seedStored = (
  factory: FakeIDBFactory,
  id: string,
  name: string,
  updatedAt: number
) => {
  factory.db.data.set(id, { id, name, updatedAt, project: createBlankProject(name, 512) });
};

const SeededShell = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioShell />;
};

const renderShell = (node: ReactNode) => {
  // The provider reads the hash on mount: an open document is `#/edit-space`,
  // which is where the titlebar menus act on a real project.
  window.location.hash = '#/edit-space';
  return render(
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>{node}</ComposerProvider>
        <ToastViewport />
      </ToastProvider>
    </TooltipProvider>
  );
};

/** Menubar items open on pointer-down; the trigger itself is a `menuitem`. */
const openMenu = (name: string) => {
  const trigger = screen.getByRole('menuitem', { name });
  fireEvent.pointerDown(trigger);
  return { trigger, menu: screen.getByRole('menu') };
};

const closeMenu = async (menu: HTMLElement) => {
  fireEvent.keyDown(menu, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
};

const itemTexts = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

describe('Studio titlebar — menu bar, breadcrumb, window controls', () => {
  it('lays out the four zones left to right: brand, menu bar, breadcrumb, window controls', () => {
    renderShell(<SeededShell project={createBlankProject('Zones', 512)} />);
    const banner = screen.getByRole('banner');

    const brand = within(banner).getByRole('button', { name: 'Go to workspaces' });
    // F1: logo + title, never truncated (flex: 0 0 auto in the stylesheet).
    expect(brand).toHaveTextContent('Icon-Core');
    expect(brand).toHaveTextContent('BETA');

    // F2: the menu bar — four PT slots, in the plan's order.
    const menubar = within(banner).getByRole('menubar', { name: 'Main menu' });
    expect(
      within(menubar)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Arquivo', 'Editar', 'Exibir', 'Sobre']);
    // The collector trigger this bar used to have is gone, not duplicated.
    expect(within(banner).queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    expect(banner.querySelector('svg.lucide-menu')).toBeNull();
    expect(banner.querySelector('svg.lucide-more-horizontal')).toBeNull();

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
    expect(zones[1]).toBe(menubar);
    expect(zones[2]).toBe(doc);
    expect(zones[3]).toBe(controls);
  });

  it('opens Arquivo with the closed PT set, one group break and honest recents', () => {
    renderShell(<SeededShell project={createBlankProject('Arquivo', 512)} />);
    const { menu } = openMenu('Arquivo');

    expect(itemTexts(menu)).toEqual([
      'Novo',
      `Abrir${modKey()}+O`,
      'Nenhum projeto recente',
      'Renomear',
      'Fechar',
      `Salvar${modKey()}+S`,
      `Salvar como${modKey()}+Shift+S`,
      `Exportar${modKey()}+E`
    ]);
    // One separator: document actions above, output below. Recentes is a
    // label, never a submenu.
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    expect(within(menu).getByText('Recentes')).toBeInTheDocument();
    expect(within(menu).queryByRole('menu')).not.toBeInTheDocument();
    // "Abrir pasta" is not in the app, so the menu does not promise it.
    expect(within(menu).queryByText(/pasta|folder/i)).not.toBeInTheDocument();
  });

  it('opens Editar, Exibir and Sobre with the planned rows', async () => {
    renderShell(<SeededShell project={createBlankProject('Menus', 512)} />);

    const edit = openMenu('Editar').menu;
    expect(itemTexts(edit)).toEqual([
      `Desfazer${modKey()}+Z`,
      `Refazer${modKey()}+Shift+Z`,
      `Duplicar${modKey()}+D`
    ]);
    await closeMenu(edit);

    const view = openMenu('Exibir').menu;
    expect(itemTexts(view)).toEqual([
      'Grade — DesligadaG',
      `Aproximar${modKey()}+=`,
      `Afastar${modKey()}+−`,
      `Zoom 100%${modKey()}+0`
    ]);
    // The radios are options, not plain items, and they carry the plan's set.
    // Variant identities keep their one spelling (variantLabels) — the module
    // header documents why they are not localized inside the menu.
    expect(
      within(view)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent)
    ).toEqual(['Default', 'Light', 'Dark', 'Monochrome', 'Claro', 'Escuro', 'Sistema']);
    expect(within(view).getByText('Variantes')).toBeInTheDocument();
    expect(within(view).getByText('Tema')).toBeInTheDocument();
    expect(within(view).getAllByRole('separator')).toHaveLength(2);
    await closeMenu(view);

    const about = openMenu('Sobre').menu;
    expect(itemTexts(about)).toEqual(['Atalhos?', 'Preferências', 'Sobre o Icon-Core']);
    await closeMenu(about);
  });

  it('keeps disabled actions honest with aria-disabled, never DOM disabled', () => {
    // No project: the welcome is over the shell, and the document half is
    // honest about having nothing to act on.
    renderShell(<StudioShell />);

    const file = openMenu('Arquivo').menu;
    for (const name of ['Nenhum projeto recente', 'Renomear', 'Fechar', /^SalvarCtrl/, /^Salvar como/, /^Exportar/]) {
      const item = within(file).getByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).not.toHaveAttribute('disabled');
    }
    for (const name of ['Novo', /^Abrir/]) {
      expect(within(file).getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled');
    }
    fireEvent.keyDown(file, { key: 'Escape' });

    // No history and no selection: nothing to undo, redo or duplicate.
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Editar' }));
    const edit = screen.getByRole('menu');
    for (const name of [/Desfazer/, /Refazer/, /Duplicar/]) {
      expect(within(edit).getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    fireEvent.keyDown(edit, { key: 'Escape' });

    // The view flags exist independently of the document, so Exibir acts.
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Exibir' }));
    const view = screen.getByRole('menu');
    expect(within(view).getByRole('menuitem', { name: /Grade — Desligada/ })).not.toHaveAttribute('aria-disabled');
    expect(within(view).getByRole('menuitem', { name: /Aproximar/ })).not.toHaveAttribute('aria-disabled');
    fireEvent.keyDown(view, { key: 'Escape' });

    // Sobre is always available.
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Sobre' }));
    const about = screen.getByRole('menu');
    for (const name of ['Atalhos?', 'Preferências', 'Sobre o Icon-Core']) {
      expect(within(about).getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('lists the five newest stored projects — and opens the one clicked', async () => {
    const factory = useStore();
    // Insertion order is not recency order: the menu owns its contract.
    seedStored(factory, 'p-alpha', 'Alpha', 1000);
    seedStored(factory, 'p-foxtrot', 'Foxtrot', 1050);
    seedStored(factory, 'p-charlie', 'Charlie', 1020);
    seedStored(factory, 'p-echo', 'Echo', 1040);
    seedStored(factory, 'p-bravo', 'Bravo', 1010);
    seedStored(factory, 'p-delta', 'Delta', 1030);

    renderShell(<StudioShell />);
    const { menu } = openMenu('Arquivo');
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Foxtrot' })).toBeInTheDocument());

    const recentNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
    expect(
      itemTexts(menu).filter((text): text is string => recentNames.includes(text ?? ''))
    ).toEqual(['Foxtrot', 'Echo', 'Delta', 'Charlie', 'Bravo']);
    // The oldest of six is the one the cap drops.
    expect(within(menu).queryByRole('menuitem', { name: 'Alpha' })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Echo' }));
    await waitFor(() => expect(screen.getByRole('banner')).toHaveTextContent('Echo'));
    expect(screen.queryByRole('dialog', { name: 'Start a new icon' })).not.toBeInTheDocument();
  });

  it('answers a vanished recent with a toast instead of silence', async () => {
    const factory = useStore();
    seedStored(factory, 'p-gone', 'Gone', 500);

    renderShell(<StudioShell />);
    const { menu } = openMenu('Arquivo');
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Gone' })).toBeInTheDocument());

    // The record disappears between the list being drawn and the click.
    factory.db.data.delete('p-gone');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Gone' }));

    await waitFor(() =>
      expect(screen.getByText('Could not open that project.')).toBeInTheDocument()
    );
    // Nothing opened: the welcome is still the surface.
    expect(screen.getByRole('dialog', { name: 'Start a new icon' })).toBeInTheDocument();
  });

  it('sets the theme from the Exibir radio and reports the current choice', () => {
    renderShell(<SeededShell project={createBlankProject('Tema', 512)} />);

    const first = openMenu('Exibir').menu;
    expect(within(first).getByRole('menuitemradio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(first).getByRole('menuitemradio', { name: 'Claro' }));
    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const second = openMenu('Exibir').menu;
    expect(within(second).getByRole('menuitemradio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(second).getByRole('menuitemradio', { name: 'Escuro' }));
    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('closes a menu on Escape and gives the focus back to its trigger', async () => {
    renderShell(<SeededShell project={createBlankProject('Escape', 512)} />);
    const { trigger, menu } = openMenu('Sobre');
    expect(within(menu).getByRole('menuitem', { name: 'Sobre o Icon-Core' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Radix restores the focus when the content unmounts, which is after the
    // close animation frame — the same as in the browser.
    await waitFor(() => expect(trigger).toHaveFocus());
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
