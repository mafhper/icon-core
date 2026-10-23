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

/**
 * jsdom has no `matchMedia` and lays nothing out. `matchMedia` still answers
 * the shell's own queries (the panel layout asks it for the window classes);
 * the menu zone no longer does — F2 is decided by measurement, which the
 * tests declare through `measureMenus` below.
 */
const stubMatchMedia = () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-tauri');
  stubMatchMedia();
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

/** Every actionable row of a menu — plain items and radios — in DOM order. */
const rowTexts = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')).map(
    (row) => row.textContent
  );

/** The narrow F2 trigger: a dropdown, so it opens on pointer-down as well. */
const openHamburger = () => {
  const trigger = screen.getByRole('button', { name: 'Main menu' });
  fireEvent.pointerDown(trigger);
  return { trigger, menu: screen.getByRole('menu', { name: 'Main menu' }) };
};

/**
 * F2 swaps on measured boxes, never on a media query. jsdom has no layout and
 * no `ResizeObserver`, so each test declares what a browser would report —
 * the menu zone's boxes and the breadcrumb's stretch — and delivers the
 * window `resize` the zone falls back to.
 *
 * Wide, the zone reports the width the four slots need (`needed`, the bar
 * never shrinks) and the room it got (`client`); narrow, `client` is the
 * hamburger's 26px box and `stretch` is everything the window has left.
 */
const measureMenus = ({
  client,
  needed,
  stretch
}: {
  client: number;
  needed: number;
  stretch: number;
}) => {
  const zone = document.querySelector('.studio-menus') as HTMLElement;
  const breadcrumb = document.querySelector('.studio-doc') as HTMLElement;
  Object.defineProperty(zone, 'clientWidth', { value: client, configurable: true });
  Object.defineProperty(zone, 'scrollWidth', { value: needed, configurable: true });
  Object.defineProperty(breadcrumb, 'clientWidth', { value: stretch, configurable: true });
  fireEvent(window, new Event('resize'));
};

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
    // The measured menu zone wraps the bar: the bar is what zones[1] shows.
    expect(zones[1]).toHaveClass('studio-menus');
    expect(zones[1]).toContainElement(menubar);
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

describe('Studio titlebar — measured menu zone (P6)', () => {
  it('swaps only F2 for the 26px hamburger when the bar overflows; brand and window controls never collapse', async () => {
    renderShell(<SeededShell project={createBlankProject('Narrow', 512)} />);
    const banner = screen.getByRole('banner');
    // The four slots need 276px and got 240: the zone reports the overflow.
    measureMenus({ client: 240, needed: 276, stretch: 0 });

    // The four slots are the wide presentation; an overflowing zone renders
    // the hamburger instead — not as a sibling, as the zone's own shape.
    expect(within(banner).queryByRole('menubar')).not.toBeInTheDocument();

    // F2 is the hamburger: one trigger, kit metric, `aria-expanded` from the
    // dropdown primitive itself.
    const trigger = within(banner).getByRole('button', { name: 'Main menu' });
    expect(trigger).toHaveClass('studio-menu-hamburger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // F1, F3 and F4 stay put: only the menu zone changes shape.
    expect(within(banner).getByRole('button', { name: 'Go to workspaces' })).toBeInTheDocument();
    expect(banner.querySelector('.studio-doc')).not.toBeNull();
    expect(banner.querySelector('.studio-window-controls')).not.toBeNull();
    const zones = Array.from(banner.children);
    expect(zones).toHaveLength(4);
    expect(zones[1]).toHaveClass('studio-menus');
    expect(zones[1]).toContainElement(trigger);

    // Opening flips `aria-expanded`; Escape closes and puts it back.
    fireEvent.pointerDown(trigger);
    const menu = screen.getByRole('menu', { name: 'Main menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('re-expands only with slack: dragging across the boundary does not flap', () => {
    renderShell(<SeededShell project={createBlankProject('Band', 512)} />);

    // The wide bar at its natural 276px — exactly enough room: it stays.
    measureMenus({ client: 276, needed: 276, stretch: 0 });
    expect(screen.getByRole('menubar')).toBeInTheDocument();

    // One pixel short: the zone overflows → the hamburger.
    measureMenus({ client: 275, needed: 276, stretch: 0 });
    expect(screen.queryByRole('menubar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main menu' })).toBeInTheDocument();

    // The band (276…307px of room): the bar would fit again, but without
    // slack nothing moves — 278px…
    measureMenus({ client: 26, needed: 26, stretch: 252 });
    expect(screen.queryByRole('menubar')).not.toBeInTheDocument();

    // …and 307px, one short of 276 + 32, are still the band.
    measureMenus({ client: 26, needed: 26, stretch: 281 });
    expect(screen.queryByRole('menubar')).not.toBeInTheDocument();

    // 308px = the bar plus the 32px of recovered slack: the four slots return.
    measureMenus({ client: 26, needed: 26, stretch: 282 });
    expect(screen.getByRole('menubar')).toBeInTheDocument();

    // Shrinking back into the band keeps the wide bar — it does not oscillate.
    measureMenus({ client: 276, needed: 276, stretch: 30 });
    expect(screen.getByRole('menubar')).toBeInTheDocument();

    // Overflow again, and only then, the hamburger comes back.
    measureMenus({ client: 275, needed: 276, stretch: 0 });
    expect(screen.queryByRole('menubar')).not.toBeInTheDocument();
  });

  it('closes the open menu when the zone swaps and hands the focus to the new trigger', async () => {
    renderShell(<SeededShell project={createBlankProject('Swap', 512)} />);

    // Wide menu open → the zone overflows mid-flight.
    openMenu('Arquivo');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    measureMenus({ client: 240, needed: 276, stretch: 0 });

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    const hamburger = screen.getByRole('button', { name: 'Main menu' });
    await waitFor(() => expect(hamburger).toHaveFocus());

    // Narrow panel open → the zone recovers slack: the focus goes to the
    // first slot, which is where the same position now lives.
    fireEvent.pointerDown(hamburger);
    expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
    measureMenus({ client: 26, needed: 26, stretch: 282 });

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Arquivo' })).toHaveFocus());
  });

  it('renders the wide bar model: four sections, same rows, actions and shortcuts', async () => {
    renderShell(<SeededShell project={createBlankProject('Parity', 512)} />);
    const wideRows: Array<string | null> = [];
    for (const name of ['Arquivo', 'Editar', 'Exibir', 'Sobre']) {
      const { menu } = openMenu(name);
      wideRows.push(...rowTexts(menu));
      await closeMenu(menu);
    }
    // The model stays clear of the surfaces that own their actions: View
    // options (canvas bar), Insert (Layers header) and the Export tab.
    for (const flag of [
      'Keylines',
      'Import margin',
      'Safe area',
      'Icon mask',
      'Snapping guides',
      'Reset view'
    ]) {
      expect(wideRows.some((row) => row?.includes(flag))).toBe(false);
    }

    // Same app, measured overflow: the hamburger panel carries the same rows.
    cleanup();
    renderShell(<SeededShell project={createBlankProject('Parity', 512)} />);
    measureMenus({ client: 240, needed: 276, stretch: 0 });
    const { menu } = openHamburger();

    expect(rowTexts(menu)).toEqual(wideRows);

    // The four sections are headings here (labels, not collection items)…
    for (const section of ['Arquivo', 'Editar', 'Exibir', 'Sobre']) {
      expect(within(menu).getByText(section)).toBeInTheDocument();
      expect(within(menu).queryByRole('menuitem', { name: section })).not.toBeInTheDocument();
    }
    // …and Recentes is a group in this presentation too, never a submenu.
    expect(within(menu).getByText('Recentes')).toBeInTheDocument();
    expect(within(menu).queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps disabled rows focusable and sets the theme from the narrow panel', () => {
    // No project: the document half is honest about having nothing to act on.
    renderShell(<StudioShell />);
    measureMenus({ client: 240, needed: 276, stretch: 0 });

    const menu = openHamburger().menu;
    for (const name of ['Nenhum projeto recente', 'Renomear', 'Fechar', /^SalvarCtrl/, /^Salvar como/, /^Exportar/]) {
      const item = within(menu).getByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).not.toHaveAttribute('disabled');
    }
    expect(within(menu).getByRole('menuitem', { name: /^Novo/ })).not.toHaveAttribute('aria-disabled');

    // The theme radio is the same setting in both shapes: one preference,
    // persisted and resolved through the one `writeThemePreference`.
    expect(within(menu).getByRole('menuitemradio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Claro' }));
    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
