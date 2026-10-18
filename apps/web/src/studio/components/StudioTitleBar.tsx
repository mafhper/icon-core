import { useEffect, useState } from 'react';
import {
  Box,
  ChevronRight,
  Download,
  FilePlus,
  FileX2,
  Info,
  Keyboard,
  Menu as MenuIcon,
  Moon,
  PenLine,
  Save,
  Settings2,
  Sun
} from 'lucide-react';
import { Menu, MenuItem, MenuSeparator, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { AboutModal } from '../../composer/components/AboutModal';
import { requestExportFocus } from '../../composer/utils/exportFocus';
import { modKey } from '../../composer/utils/platform';
import { isDesktopRuntime } from '../../lib/desktopExport';
import type { StudioResolvedTheme, StudioThemePreference } from '../useStudioTheme';
import { variantLabel } from '../variantLabels';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';
import { StudioWindowControls } from './StudioWindowControls';

type StudioMenuDialog = 'new' | 'rename' | 'preferences' | 'confirm-new' | 'confirm-close' | 'about' | null;

interface StudioTitleBarProps {
  themePreference: StudioThemePreference;
  /** The theme in force — `system` already resolved by the OS. */
  themeResolved: StudioResolvedTheme;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
}

/**
 * The theme row is a switch, not a menu of three: it names the state it takes
 * you to. `system` survives as the stored default and as a choice in
 * Preferences — it is not a third state the row could show.
 */
const themeSwitchLabel = (resolved: StudioResolvedTheme) =>
  `Switch to ${resolved === 'light' ? 'dark' : 'light'} theme`;

const themeSwitchTarget = (resolved: StudioResolvedTheme): StudioThemePreference =>
  resolved === 'light' ? 'dark' : 'light';

/**
 * Studio titlebar (minimal bar): four zones, left to right.
 *
 * F1 — the brand (logo + title + BETA) never truncates; F2 — one collector
 * trigger (hamburger + "Menu") holds **every** bar action, in three groups;
 * F3 — the document breadcrumb is elastic and only the name elides, because
 * it reports status and is not navigation; F4 — the window controls
 * (minimize / maximize-restore / close) belong to the desktop shell and are
 * painted only under Tauri (`.studio-window-controls` is `display: none` on
 * the web, where the browser owns its own chrome).
 *
 * There is no measured fold and no breakpoint: the bar does not fold actions
 * by width anymore. The breadcrumb gives the slack back first, the collector
 * keeps all nine actions in one menu — same labels, same icons, same shortcut
 * hints they had as bar buttons, with disabled ones preserved as
 * `aria-disabled`. The cost is deliberate: Save and Export are one conscious
 * click away instead of a bare bar button, and their bindings (`Ctrl/Cmd+S`,
 * `Ctrl/Cmd+E`) are untouched.
 *
 * The panel toggles stay at the canvas bar edges, Insert stays in the Layers
 * header, View options stays in the canvas bar and Export stays the Inspector
 * Export tab: this bar duplicates none of them.
 */
export const StudioTitleBar = ({
  themePreference,
  themeResolved,
  onThemePreference,
  onOpenShortcuts
}: StudioTitleBarProps) => {
  const { state, dispatch, navigate, saveProject } = useComposer();
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
  const isLight = themeResolved === 'light';

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
        <Menu
          label="Menu"
          trigger={
            <button type="button" className="studio-bar-action" aria-label="Menu">
              <MenuIcon size={14} />
              <span>Menu</span>
            </button>
          }
        >
          {/* Document */}
          <MenuItem
            icon={<FilePlus size={14} />}
            label="New document"
            onSelect={() => setMenuDialog(hasProject ? 'confirm-new' : 'new')}
          />
          <MenuItem
            icon={<PenLine size={14} />}
            label="Rename document"
            disabled={!hasProject}
            onSelect={() => setMenuDialog('rename')}
          />
          <MenuItem
            icon={<FileX2 size={14} />}
            label="Close document"
            disabled={!hasProject}
            onSelect={() => setMenuDialog('confirm-close')}
          />
          <MenuSeparator />
          {/* Output */}
          <MenuItem
            icon={<Save size={14} />}
            label="Save session"
            shortcut={`${mod}+S`}
            disabled={!hasProject}
            onSelect={() => void saveProject()}
          />
          <MenuItem
            icon={<Download size={14} />}
            label="Export icons"
            shortcut={`${mod}+E`}
            disabled={!hasProject}
            onSelect={() => {
              // Export is the Inspector tab: the bar takes the studio there.
              navigate('edit-space');
              requestExportFocus();
            }}
          />
          <MenuSeparator />
          {/* System */}
          <MenuItem
            icon={isLight ? <Moon size={14} /> : <Sun size={14} />}
            label={themeSwitchLabel(themeResolved)}
            onSelect={() => onThemePreference(themeSwitchTarget(themeResolved))}
          />
          <MenuItem
            icon={<Keyboard size={14} />}
            label="Keyboard shortcuts"
            shortcut="?"
            onSelect={onOpenShortcuts}
          />
          <MenuItem
            icon={<Settings2 size={14} />}
            label="Preferences"
            onSelect={() => setMenuDialog('preferences')}
          />
          <MenuItem
            icon={<Info size={14} />}
            label="About Icon-Core"
            onSelect={() => setMenuDialog('about')}
          />
        </Menu>
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
