import { useEffect, useState } from 'react';
import {
  Box,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FileX2,
  FolderOpen,
  Focus,
  Grid2X2,
  Info,
  Keyboard,
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
import { AboutModal } from '../../composer/components/AboutModal';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../composer/constants';
import { requestExportFocus } from '../../composer/utils/exportFocus';
import { modKey } from '../../composer/utils/platform';
import { isDesktopRuntime } from '../../lib/desktopExport';
import { pickRecents } from '../recentProjects';
import { recentOpenFailedMessage, studioMenuLabels } from '../studioMenuLabels';
import type { StudioThemePreference } from '../useStudioTheme';
import { variantLabel, variantTiles } from '../variantLabels';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';
import { StudioWindowControls } from './StudioWindowControls';

type StudioMenuDialog = 'new' | 'rename' | 'preferences' | 'confirm-new' | 'confirm-close' | 'about' | null;

interface StudioTitleBarProps {
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
}

/**
 * Studio titlebar (F2): the desktop menu bar, four zones left to right.
 *
 * Z1 — the brand (logo + title + BETA) never truncates; Z2 — the `Menubar`
 * with the closed PT set from the plan: **Arquivo** (Novo, Abrir, Recentes,
 * Renomear, Fechar | Salvar, Salvar como, Exportar), **Editar** (Desfazer,
 * Refazer, Duplicar), **Exibir** (Grade, zoom, Variantes e o rádio Tema) and
 * **Sobre** (Atalhos, Preferências, Sobre); Z3 — the document breadcrumb is
 * elastic and only the name elides, because it reports status and is not
 * navigation; Z4 — the window controls (minimize / maximize-restore / close)
 * belong to the desktop shell and are painted only under Tauri.
 *
 * The menu **displays** shortcuts and never installs listeners: the single
 * owner of every binding is the Composer's `useKeyboardShortcuts` (Ctrl+O
 * opened the project, Ctrl+Shift+S is Save as, Ctrl+N is deliberately
 * unbound). A row whose combination is not installed would be the one lie
 * this family of components exists to prevent.
 *
 * **Recentes is flat, by plan.** The five most recent stored projects sit
 * inline under the group label — never behind a nested submenu — and are
 * read-only consumption of the provider's list (`pickRecents` owns "newest
 * first, capped"). A recent that no longer reads back is not silently
 * dropped: it answers with a toast, the same failure the welcome absorbs by
 * refreshing. With no stored projects at all, the group says so in one
 * disabled row instead of rendering an empty section or a dead action.
 *
 * Menu text lives in `studioMenuLabels`; the dialogs it opens, the toasts
 * and the canvas chrome stay English on purpose — the map's boundary is
 * documented in that module.
 */
export const StudioTitleBar = ({
  themePreference,
  onThemePreference,
  onOpenShortcuts
}: StudioTitleBarProps) => {
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
  const [menuDialog, setMenuDialog] = useState<StudioMenuDialog>(null);
  const project = state.project;
  const hasProject = Boolean(project);
  const desktop = isDesktopRuntime();

  // The desktop shell's chrome (window buttons + drag region) hangs off this
  // attribute; the web never sets it. It is also what CSS keys
  // `.studio-window-controls` on, so the zone lifts off `display: none` only
  // where the shell that owns it is present.
  useEffect(() => {
    if (desktop) document.documentElement.setAttribute('data-tauri', '');
  }, [desktop]);

  const mod = modKey();
  const recents = pickRecents(storedProjects);
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const openRecent = async (id: string) => {
    const opened = await openStoredProject(id);
    // The record can be gone between the list being drawn and the click. That
    // is a stale row, not a crash — and the person is owed the difference.
    if (!opened) toast.error(recentOpenFailedMessage);
  };

  return (
    <>
      <header className="studio-titlebar" data-tauri-drag-region={desktop ? 'deep' : undefined}>
        <button
          type="button"
          className="studio-brand studio-brand-button"
          aria-label="Go to workspaces"
          title="Go to workspaces"
          onClick={() => navigate('workspaces')}
        >
          {withIconStroke(<Box size={17} />, 'semibold')}
          <span>Icon-Core</span>
          <span className="studio-beta">BETA</span>
        </button>
        <Menubar aria-label="Main menu" className="shrink-0">
          {/* Arquivo */}
          <MenubarMenu>
            <MenubarTrigger>{studioMenuLabels.menus.file}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                icon={<FilePlus size={14} />}
                label={studioMenuLabels.file.new}
                onSelect={() => setMenuDialog(hasProject ? 'confirm-new' : 'new')}
              />
              <MenubarItem
                icon={<FolderOpen size={14} />}
                label={studioMenuLabels.file.open}
                shortcut={`${mod}+O`}
                onSelect={() => void openProjectFile()}
              />
              <MenubarLabel>{studioMenuLabels.file.recents}</MenubarLabel>
              {recents.length === 0 ? (
                <MenubarItem
                  label={studioMenuLabels.file.recentsEmpty}
                  disabled
                  onSelect={() => undefined}
                />
              ) : (
                recents.map((recent) => (
                  <MenubarItem
                    key={recent.id}
                    label={recent.name}
                    onSelect={() => void openRecent(recent.id)}
                  />
                ))
              )}
              <MenubarItem
                icon={<PenLine size={14} />}
                label={studioMenuLabels.file.rename}
                disabled={!hasProject}
                onSelect={() => setMenuDialog('rename')}
              />
              <MenubarItem
                icon={<FileX2 size={14} />}
                label={studioMenuLabels.file.close}
                disabled={!hasProject}
                onSelect={() => setMenuDialog('confirm-close')}
              />
              <MenubarSeparator />
              <MenubarItem
                icon={<Save size={14} />}
                label={studioMenuLabels.file.save}
                shortcut={`${mod}+S`}
                disabled={!hasProject}
                onSelect={() => void saveProject()}
              />
              <MenubarItem
                icon={<Save size={14} />}
                label={studioMenuLabels.file.saveAs}
                shortcut={`${mod}+Shift+S`}
                disabled={!hasProject}
                onSelect={() => void saveProjectAs()}
              />
              <MenubarItem
                icon={<Download size={14} />}
                label={studioMenuLabels.file.export}
                shortcut={`${mod}+E`}
                disabled={!hasProject}
                onSelect={() => {
                  // Export is the Inspector tab: the bar takes the studio there.
                  navigate('edit-space');
                  requestExportFocus();
                }}
              />
            </MenubarContent>
          </MenubarMenu>
          {/* Editar */}
          <MenubarMenu>
            <MenubarTrigger>{studioMenuLabels.menus.edit}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                icon={<Undo2 size={14} />}
                label={studioMenuLabels.edit.undo}
                shortcut={`${mod}+Z`}
                disabled={!canUndo}
                onSelect={() => dispatch({ type: 'UNDO' })}
              />
              <MenubarItem
                icon={<Redo2 size={14} />}
                label={studioMenuLabels.edit.redo}
                shortcut={`${mod}+Shift+Z`}
                disabled={!canRedo}
                onSelect={() => dispatch({ type: 'REDO' })}
              />
              <MenubarItem
                icon={<Copy size={14} />}
                label={studioMenuLabels.edit.duplicate}
                shortcut={`${mod}+D`}
                disabled={!state.activeLayerId}
                onSelect={() => {
                  if (state.activeLayerId) {
                    dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } });
                  }
                }}
              />
            </MenubarContent>
          </MenubarMenu>
          {/* Exibir */}
          <MenubarMenu>
            <MenubarTrigger>{studioMenuLabels.menus.view}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                icon={<Grid2X2 size={14} />}
                label={state.showGrid ? studioMenuLabels.view.gridOn : studioMenuLabels.view.gridOff}
                shortcut="G"
                onSelect={() => dispatch({ type: 'TOGGLE_GRID' })}
              />
              <MenubarItem
                icon={<ZoomIn size={14} />}
                label={studioMenuLabels.view.zoomIn}
                shortcut={`${mod}+=`}
                onSelect={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
              />
              <MenubarItem
                icon={<ZoomOut size={14} />}
                label={studioMenuLabels.view.zoomOut}
                shortcut={`${mod}+−`}
                onSelect={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
              />
              <MenubarItem
                icon={<Focus size={14} />}
                label={studioMenuLabels.view.zoomReset}
                shortcut={`${mod}+0`}
                onSelect={() => dispatch({ type: 'SET_ZOOM', payload: 1 })}
              />
              <MenubarSeparator />
              <MenubarLabel>{studioMenuLabels.view.variants}</MenubarLabel>
              <MenubarRadioGroup
                value={state.activeVariant}
                onValueChange={(value) =>
                  dispatch({ type: 'SET_ACTIVE_VARIANT', payload: value as IconVariant })
                }
              >
                {variantTiles().map((tile) => (
                  <MenubarRadioItem key={tile.id} value={tile.id} label={tile.label} />
                ))}
              </MenubarRadioGroup>
              <MenubarSeparator />
              <MenubarLabel>{studioMenuLabels.view.theme}</MenubarLabel>
              <MenubarRadioGroup
                value={themePreference}
                onValueChange={(value) => onThemePreference(value as StudioThemePreference)}
              >
                <MenubarRadioItem value="light" label={studioMenuLabels.view.themeLight} />
                <MenubarRadioItem value="dark" label={studioMenuLabels.view.themeDark} />
                <MenubarRadioItem value="system" label={studioMenuLabels.view.themeSystem} />
              </MenubarRadioGroup>
            </MenubarContent>
          </MenubarMenu>
          {/* Sobre */}
          <MenubarMenu>
            <MenubarTrigger>{studioMenuLabels.menus.about}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                icon={<Keyboard size={14} />}
                label={studioMenuLabels.about.shortcuts}
                shortcut="?"
                onSelect={onOpenShortcuts}
              />
              <MenubarItem
                icon={<Settings2 size={14} />}
                label={studioMenuLabels.about.preferences}
                onSelect={() => setMenuDialog('preferences')}
              />
              <MenubarItem
                icon={<Info size={14} />}
                label={studioMenuLabels.about.about}
                onSelect={() => setMenuDialog('about')}
              />
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <div className="studio-doc" aria-live="polite">
          <Box size={13} aria-hidden="true" />
          <strong>{project?.metadata.name ?? 'No document'}</strong>
          {state.isDirty && <span className="studio-doc-unsaved" aria-label="Unsaved changes" />}
          <ChevronRight size={12} aria-hidden="true" />
          <span>{variantLabel(state.activeVariant)}</span>
        </div>
        <StudioWindowControls />
      </header>
      {menuDialog === 'confirm-new' && (
        <StudioConfirmDialog
          title="New document?"
          message="The current document will be replaced. The autosave stores the new blank project, so anything unsaved is gone — and it stays gone."
          confirmLabel="Discard and continue"
          onConfirm={() => setMenuDialog('new')}
          onCancel={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'new' && (
        <StudioNameDialog
          title="New document"
          description="A blank canvas at the size you pick."
          initialName="Untitled"
          submitLabel="Create document"
          sizes={[256, 512, 1024]}
          initialSize={project?.canvas.size ?? 512}
          onSubmit={(name, size) => {
            dispatch({ type: 'NEW_PROJECT', payload: { name, size: size ?? 512 } });
            navigate('edit-space');
            setMenuDialog(null);
          }}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'rename' && project && (
        <StudioNameDialog
          title="Rename document"
          initialName={project.metadata.name}
          submitLabel="Rename"
          onSubmit={(name) => {
            dispatch({ type: 'SET_PROJECT_NAME', payload: name });
            setMenuDialog(null);
          }}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'confirm-close' && (
        <StudioConfirmDialog
          title="Close this document?"
          message="The canvas clears and the project list opens. Anything already saved stays in the library."
          confirmLabel="Close document"
          onConfirm={() => {
            dispatch({ type: 'CLOSE_PROJECT' });
            navigate('workspaces');
            setMenuDialog(null);
          }}
          onCancel={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'preferences' && (
        <StudioPreferencesDialog
          preference={themePreference}
          onPreference={onThemePreference}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'about' && <AboutModal onClose={() => setMenuDialog(null)} />}
    </>
  );
};
