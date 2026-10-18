import { useEffect, useState } from 'react';
import { Box, ChevronRight } from 'lucide-react';
import { withIconStroke } from '@iconcore/ui';
import { AboutModal } from '../../composer/components/AboutModal';
import { useComposer } from '../../composer/ComposerContext';
import { isDesktopRuntime } from '../../lib/desktopExport';
import { variantLabel } from '../variantLabels';
import type { StudioThemePreference } from '../useStudioTheme';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioMenus, type StudioMenuDialog } from './StudioMenus';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';
import { StudioWindowControls } from './StudioWindowControls';

interface StudioTitleBarProps {
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
}

/**
 * Studio titlebar (F2 lives inside): four zones left to right.
 *
 * Z1 — the brand (logo + title + BETA) never truncates; Z2 — the menus,
 * delegated to `StudioMenus`: the four-slot PT `Menubar` while the zone fits
 * and the hamburger once it overflows, both from one action model; Z3 — the document
 * breadcrumb is elastic and only the name elides, because it reports status
 * and is not navigation; Z4 — the window controls (minimize / maximize-restore
 * / close) belong to the desktop shell and are painted only under Tauri.
 *
 * This component owns the frame and the dialogs the menus open — the state the
 * four zones share; the rows and their actions live in `StudioMenus`, and the
 * texts in `studioMenuLabels`.
 */
export const StudioTitleBar = ({
  themePreference,
  onThemePreference,
  onOpenShortcuts
}: StudioTitleBarProps) => {
  const { state, dispatch, navigate } = useComposer();
  const [menuDialog, setMenuDialog] = useState<StudioMenuDialog>(null);
  const project = state.project;
  const desktop = isDesktopRuntime();

  // The desktop shell's chrome (window buttons + drag region) hangs off this
  // attribute; the web never sets it. It is also what CSS keys
  // `.studio-window-controls` on, so the zone lifts off `display: none` only
  // where the shell that owns it is present.
  useEffect(() => {
    if (desktop) document.documentElement.setAttribute('data-tauri', '');
  }, [desktop]);

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
        <StudioMenus
          themePreference={themePreference}
          onThemePreference={onThemePreference}
          onOpenShortcuts={onOpenShortcuts}
          onDialog={setMenuDialog}
        />
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
