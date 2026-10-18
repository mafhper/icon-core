import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  Download,
  FilePlus,
  FileX2,
  FolderOpen,
  Focus,
  Grid2X2,
  Info,
  Keyboard,
  Menu as MenuIcon,
  PenLine,
  Redo2,
  Save,
  Settings2,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { IconVariant } from '@iconcore/shared';
import {
  Menu,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
  withIconStroke
} from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { useToast } from '../../composer/toast/ToastContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../composer/constants';
import { requestExportFocus } from '../../composer/utils/exportFocus';
import { modKey } from '../../composer/utils/platform';
import { pickRecents } from '../recentProjects';
import { recentOpenFailedMessage, studioMenuLabels } from '../studioMenuLabels';
import type { StudioThemePreference } from '../useStudioTheme';
import { variantTiles } from '../variantLabels';

/** The dialogs the menus can open; the titlebar owns their state. */
export type StudioMenuDialog =
  | 'new'
  | 'rename'
  | 'preferences'
  | 'confirm-new'
  | 'confirm-close'
  | 'about'
  | null;

/** One plain action row — icon, label, shortcut display, disabled flag. */
interface StudioMenuItemEntry {
  kind: 'item';
  key: string;
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

/** Non-interactive group heading ("Recentes", "Variantes", "Tema"). */
interface StudioMenuLabelEntry {
  kind: 'label';
  key: string;
  label: string;
}

/** Divider between groups of rows. */
interface StudioMenuSeparatorEntry {
  kind: 'separator';
  key: string;
}

/** Mutually exclusive options (Variantes, Tema), rendered as a radio set. */
interface StudioMenuRadioEntry {
  kind: 'radio';
  key: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

type StudioMenuEntry =
  | StudioMenuItemEntry
  | StudioMenuLabelEntry
  | StudioMenuSeparatorEntry
  | StudioMenuRadioEntry;

/** One of the four menus: the menubar slot (wide) and the panel heading (narrow). */
interface StudioMenuSection {
  id: 'file' | 'edit' | 'view' | 'about';
  label: string;
  entries: StudioMenuEntry[];
}

interface StudioMenuModelOptions {
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
  onDialog: (dialog: StudioMenuDialog) => void;
}

/**
 * The one action model for zone F2. Both presentations render exactly these
 * sections; neither owns a row of its own.
 *
 * The closed set is the plan's PT map — Arquivo (Novo, Abrir, Recentes,
 * Renomear, Fechar | Salvar, Salvar como, Exportar), Editar (Desfazer,
 * Refazer, Duplicar), Exibir (Grade, zoom, Variantes e o rádio Tema) and
 * Sobre (Atalhos, Preferências, Sobre). The bar duplicates none of the
 * surfaces that already own their actions: Insert stays the Layers header,
 * View options stays the canvas bar, Export stays the Inspector Export tab
 * (the Exportar row takes the studio there — it never opens a second surface).
 *
 * Handlers close over live state on every render: `hasProject`, the history
 * ends and the zoom all re-evaluate with the store, so a row's `disabled` is
 * never stale.
 */
const useStudioMenuModel = ({
  themePreference,
  onThemePreference,
  onOpenShortcuts,
  onDialog
}: StudioMenuModelOptions): StudioMenuSection[] => {
  const {
    state,
    dispatch,
    navigate,
    storedProjects,
    openStoredProject,
    saveProject,
    saveProjectAs,
    openProjectFile
  } = useComposer();
  const toast = useToast();
  const mod = modKey();
  const recents = pickRecents(storedProjects);
  const hasProject = Boolean(state.project);
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const openRecent = async (id: string) => {
    const opened = await openStoredProject(id);
    // The record can be gone between the list being drawn and the click. That
    // is a stale row, not a crash — and the person is owed the difference.
    if (!opened) toast.error(recentOpenFailedMessage);
  };

  // Recentes is flat, by plan: the five most recent projects inline under the
  // group label, never behind a nested submenu; with none stored, one honest
  // disabled row instead of an empty section.
  const recentEntries: StudioMenuEntry[] =
    recents.length === 0
      ? [
          {
            kind: 'item',
            key: 'recents-empty',
            label: studioMenuLabels.file.recentsEmpty,
            disabled: true,
            onSelect: () => undefined
          }
        ]
      : recents.map((recent) => ({
          kind: 'item',
          key: `recent-${recent.id}`,
          label: recent.name,
          onSelect: () => void openRecent(recent.id)
        }));

  return [
    {
      id: 'file',
      label: studioMenuLabels.menus.file,
      entries: [
        {
          kind: 'item',
          key: 'new',
          icon: <FilePlus size={14} />,
          label: studioMenuLabels.file.new,
          onSelect: () => onDialog(hasProject ? 'confirm-new' : 'new')
        },
        {
          kind: 'item',
          key: 'open',
          icon: <FolderOpen size={14} />,
          label: studioMenuLabels.file.open,
          shortcut: `${mod}+O`,
          onSelect: () => void openProjectFile()
        },
        { kind: 'label', key: 'recents', label: studioMenuLabels.file.recents },
        ...recentEntries,
        {
          kind: 'item',
          key: 'rename',
          icon: <PenLine size={14} />,
          label: studioMenuLabels.file.rename,
          disabled: !hasProject,
          onSelect: () => onDialog('rename')
        },
        {
          kind: 'item',
          key: 'close',
          icon: <FileX2 size={14} />,
          label: studioMenuLabels.file.close,
          disabled: !hasProject,
          onSelect: () => onDialog('confirm-close')
        },
        { kind: 'separator', key: 'file-break' },
        {
          kind: 'item',
          key: 'save',
          icon: <Save size={14} />,
          label: studioMenuLabels.file.save,
          shortcut: `${mod}+S`,
          disabled: !hasProject,
          onSelect: () => void saveProject()
        },
        {
          kind: 'item',
          key: 'save-as',
          icon: <Save size={14} />,
          label: studioMenuLabels.file.saveAs,
          shortcut: `${mod}+Shift+S`,
          disabled: !hasProject,
          onSelect: () => void saveProjectAs()
        },
        {
          kind: 'item',
          key: 'export',
          icon: <Download size={14} />,
          label: studioMenuLabels.file.export,
          shortcut: `${mod}+E`,
          disabled: !hasProject,
          onSelect: () => {
            // Export is the Inspector tab: the bar takes the studio there.
            navigate('edit-space');
            requestExportFocus();
          }
        }
      ]
    },
    {
      id: 'edit',
      label: studioMenuLabels.menus.edit,
      entries: [
        {
          kind: 'item',
          key: 'undo',
          icon: <Undo2 size={14} />,
          label: studioMenuLabels.edit.undo,
          shortcut: `${mod}+Z`,
          disabled: !canUndo,
          onSelect: () => dispatch({ type: 'UNDO' })
        },
        {
          kind: 'item',
          key: 'redo',
          icon: <Redo2 size={14} />,
          label: studioMenuLabels.edit.redo,
          shortcut: `${mod}+Shift+Z`,
          disabled: !canRedo,
          onSelect: () => dispatch({ type: 'REDO' })
        },
        {
          kind: 'item',
          key: 'duplicate',
          icon: <Copy size={14} />,
          label: studioMenuLabels.edit.duplicate,
          shortcut: `${mod}+D`,
          disabled: !state.activeLayerId,
          onSelect: () => {
            if (state.activeLayerId) {
              dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } });
            }
          }
        }
      ]
    },
    {
      id: 'view',
      label: studioMenuLabels.menus.view,
      entries: [
        {
          kind: 'item',
          key: 'grid',
          icon: <Grid2X2 size={14} />,
          label: state.showGrid ? studioMenuLabels.view.gridOn : studioMenuLabels.view.gridOff,
          shortcut: 'G',
          onSelect: () => dispatch({ type: 'TOGGLE_GRID' })
        },
        {
          kind: 'item',
          key: 'zoom-in',
          icon: <ZoomIn size={14} />,
          label: studioMenuLabels.view.zoomIn,
          shortcut: `${mod}+=`,
          onSelect: () => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })
        },
        {
          kind: 'item',
          key: 'zoom-out',
          icon: <ZoomOut size={14} />,
          label: studioMenuLabels.view.zoomOut,
          shortcut: `${mod}+−`,
          onSelect: () => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })
        },
        {
          kind: 'item',
          key: 'zoom-reset',
          icon: <Focus size={14} />,
          label: studioMenuLabels.view.zoomReset,
          shortcut: `${mod}+0`,
          onSelect: () => dispatch({ type: 'SET_ZOOM', payload: 1 })
        },
        { kind: 'separator', key: 'view-break-variants' },
        { kind: 'label', key: 'variants', label: studioMenuLabels.view.variants },
        {
          kind: 'radio',
          key: 'variants-radio',
          value: state.activeVariant,
          onValueChange: (value) =>
            dispatch({ type: 'SET_ACTIVE_VARIANT', payload: value as IconVariant }),
          options: variantTiles().map((tile) => ({ value: tile.id, label: tile.label }))
        },
        { kind: 'separator', key: 'view-break-theme' },
        { kind: 'label', key: 'theme', label: studioMenuLabels.view.theme },
        {
          kind: 'radio',
          key: 'theme-radio',
          value: themePreference,
          onValueChange: (value) => onThemePreference(value as StudioThemePreference),
          options: [
            { value: 'light', label: studioMenuLabels.view.themeLight },
            { value: 'dark', label: studioMenuLabels.view.themeDark },
            { value: 'system', label: studioMenuLabels.view.themeSystem }
          ]
        }
      ]
    },
    {
      id: 'about',
      label: studioMenuLabels.menus.about,
      entries: [
        {
          kind: 'item',
          key: 'shortcuts',
          icon: <Keyboard size={14} />,
          label: studioMenuLabels.about.shortcuts,
          shortcut: '?',
          onSelect: onOpenShortcuts
        },
        {
          kind: 'item',
          key: 'preferences',
          icon: <Settings2 size={14} />,
          label: studioMenuLabels.about.preferences,
          onSelect: () => onDialog('preferences')
        },
        {
          kind: 'item',
          key: 'about',
          icon: <Info size={14} />,
          label: studioMenuLabels.about.about,
          onSelect: () => onDialog('about')
        }
      ]
    }
  ];
};

/** Renders one model entry with the menubar primitives (wide presentation). */
const MenubarEntry = ({ entry }: { entry: StudioMenuEntry }) => {
  switch (entry.kind) {
    case 'item':
      return (
        <MenubarItem
          icon={entry.icon}
          label={entry.label}
          shortcut={entry.shortcut}
          disabled={entry.disabled}
          onSelect={entry.onSelect}
        />
      );
    case 'label':
      return <MenubarLabel>{entry.label}</MenubarLabel>;
    case 'separator':
      return <MenubarSeparator />;
    case 'radio':
      return (
        <MenubarRadioGroup value={entry.value} onValueChange={entry.onValueChange}>
          {entry.options.map((option) => (
            <MenubarRadioItem key={option.value} value={option.value} label={option.label} />
          ))}
        </MenubarRadioGroup>
      );
  }
};

/** Renders one model entry with the dropdown primitives (narrow presentation). */
const DropdownEntry = ({ entry }: { entry: StudioMenuEntry }) => {
  switch (entry.kind) {
    case 'item':
      return (
        <MenuItem
          icon={entry.icon}
          label={entry.label}
          shortcut={entry.shortcut}
          disabled={entry.disabled}
          onSelect={entry.onSelect}
        />
      );
    case 'label':
      return <MenuLabel>{entry.label}</MenuLabel>;
    case 'separator':
      return <MenuSeparator />;
    case 'radio':
      return (
        <MenuRadioGroup value={entry.value} onValueChange={entry.onValueChange}>
          {entry.options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} label={option.label} />
          ))}
        </MenuRadioGroup>
      );
  }
};

/** Wide presentation: the desktop menu bar, four slots left to right. */
const StudioMenuBar = ({ sections }: { sections: StudioMenuSection[] }) => (
  <Menubar aria-label="Main menu" className="shrink-0">
    {sections.map((section) => (
      <MenubarMenu key={section.id}>
        <MenubarTrigger>{section.label}</MenubarTrigger>
        <MenubarContent>
          {section.entries.map((entry) => (
            <MenubarEntry key={entry.key} entry={entry} />
          ))}
        </MenubarContent>
      </MenubarMenu>
    ))}
  </Menubar>
);

/**
 * Narrow presentation: one hamburger whose panel carries the same four
 * sections, as `MenuLabel` headings. Flat by construction — Recentes and the
 * radios render inline, so there is no nested submenu anywhere.
 *
 * The trigger keeps the menubar trigger's metric (26px); `aria-expanded` and
 * focus return on close come from the dropdown primitive itself.
 */
const StudioMenuHamburger = ({ sections }: { sections: StudioMenuSection[] }) => (
  <Menu
    label="Main menu"
    trigger={
      <button type="button" className="studio-menu-hamburger" aria-label="Main menu">
        {withIconStroke(<MenuIcon size={16} />)}
      </button>
    }
  >
    {sections.map((section, index) => (
      <Fragment key={section.id}>
        {index > 0 && <MenuSeparator />}
        <MenuLabel>{section.label}</MenuLabel>
        {section.entries.map((entry) => (
          <DropdownEntry key={entry.key} entry={entry} />
        ))}
      </Fragment>
    ))}
  </Menu>
);

/**
 * How much room the zone must recover beyond the bar's measured width before
 * the four slots return. Collapsing is immediate — an overflowing bar *is* the
 * signal — but returning waits for real slack (the 24–32px band; 32 is the
 * conservative end this component commits to), so a window dragged across the
 * boundary cannot flap.
 */
const MENU_REOPEN_SLACK_PX = 32;

/**
 * F2 is measured, never assumed.
 *
 * The zone is a shrinkable flex item beside the elastic breadcrumb: the
 * breadcrumb (basis `0`, `min-width: 0`) gives its width up first, and only
 * then does this zone get squeezed — so `scrollWidth > clientWidth` on the
 * zone means the four slots genuinely no longer fit, wherever the window edge
 * happens to be. That is what collapses them: text scaling, a longer locale
 * and the Tauri window controls all move the line, and a viewport breakpoint
 * cannot see any of it. The bar never shrinks or wraps (`shrink-0`), so its
 * scroll box reports the width the slots need.
 *
 * Returning is deliberate: the zone must recover `MENU_REOPEN_SLACK_PX` beyond
 * the bar's measured width before the bar comes back, and that width survives
 * the narrow state so the comparison stays live at every resize.
 *
 * `ResizeObserver` drives it (the titlebar and the zone itself); jsdom has
 * none, so the window `resize` event is the fallback that keeps the component
 * testable — the tests deliver the same signal.
 *
 * A swap unmounts the outgoing shape, which closes its menu by construction;
 * when the focus was inside F2 at that moment (a focused trigger, an open
 * panel), the incoming shape's first control receives it, so focus survives.
 */
const useMenuZoneFit = () => {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  const barWidthRef = useRef(0);
  const returnFocusRef = useRef(false);
  const previousNarrowRef = useRef(narrow);

  useLayoutEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    const handOverFocus = () => {
      returnFocusRef.current =
        zone.contains(document.activeElement) ||
        zone.querySelector('[data-state="open"]') !== null;
    };

    const evaluate = () => {
      // Which shape is on screen is read from the DOM, not from state: the
      // observer can fire again before React has committed anything.
      const wide = zone.querySelector('[role="menubar"]') !== null;

      if (wide) {
        const needed = zone.scrollWidth;
        if (needed > 0) barWidthRef.current = needed;
        if (needed > zone.clientWidth) {
          handOverFocus();
          setNarrow(true);
        }
        return;
      }

      // Narrow: the hamburger's box plus the breadcrumb's stretch is exactly
      // the room the wide bar would get back.
      const breadcrumb = zone
        .closest('.studio-titlebar')
        ?.querySelector<HTMLElement>('.studio-doc');
      const available = zone.clientWidth + (breadcrumb?.clientWidth ?? 0);
      if (barWidthRef.current > 0 && available >= barWidthRef.current + MENU_REOPEN_SLACK_PX) {
        handOverFocus();
        setNarrow(false);
      }
    };

    evaluate();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', evaluate);
      return () => window.removeEventListener('resize', evaluate);
    }
    const observer = new ResizeObserver(evaluate);
    observer.observe(zone);
    const titlebar = zone.closest('.studio-titlebar');
    if (titlebar) observer.observe(titlebar);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (previousNarrowRef.current === narrow) return;
    previousNarrowRef.current = narrow;
    if (!returnFocusRef.current) return;
    returnFocusRef.current = false;
    const next = zoneRef.current?.querySelector<HTMLElement>(
      narrow ? '.studio-menu-hamburger' : '[role="menuitem"]'
    );
    next?.focus();
  }, [narrow]);

  return { zoneRef, narrow };
};

export interface StudioMenusProps extends StudioMenuModelOptions {
  themePreference: StudioThemePreference;
}

/**
 * Zone F2 of the titlebar: one action model, two presentations.
 *
 * - **Fitting:** `StudioMenuBar` — the four-slot `Menubar` (Arquivo, Editar,
 *   Exibir, Sobre), groups split by separators, shortcuts right aligned.
 * - **Overflowing:** `StudioMenuHamburger` — a single 26px trigger with
 *   `aria-expanded`, opening the same four sections as headings with the same
 *   rows, actions and shortcuts. The swap is measured (`useMenuZoneFit`),
 *   never a breakpoint.
 *
 * Only this zone swaps: the brand (F1) and the window controls (F4) never
 * collapse, and the document breadcrumb (F3) keeps yielding first.
 *
 * The menus **display** shortcuts and never install listeners: the single
 * owner of every binding is the Composer's `useKeyboardShortcuts` (Ctrl+O
 * opened the project, Ctrl+Shift+S is Save as, Ctrl+N is deliberately
 * unbound). A row whose combination is not installed would be the one lie
 * this family of components exists to prevent. Disabled rows keep
 * `aria-disabled` and stay focusable, so arrow keys still land on them and a
 * screen reader can read *why* they are unavailable.
 *
 * Menu text lives in `studioMenuLabels`; the dialogs it opens, the toasts
 * and the canvas chrome stay English on purpose — the map's boundary is
 * documented in that module.
 */
export const StudioMenus = ({
  themePreference,
  onThemePreference,
  onOpenShortcuts,
  onDialog
}: StudioMenusProps) => {
  const { zoneRef, narrow } = useMenuZoneFit();
  const sections = useStudioMenuModel({
    themePreference,
    onThemePreference,
    onOpenShortcuts,
    onDialog
  });

  return (
    <div className="studio-menus" data-narrow={narrow} ref={zoneRef}>
      {narrow ? <StudioMenuHamburger sections={sections} /> : <StudioMenuBar sections={sections} />}
    </div>
  );
};
