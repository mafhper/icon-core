import { useEffect, useState } from 'react';
import { Box, Check, ChevronRight, Keyboard, Monitor, Moon, Sun } from 'lucide-react';
import { IconButton, Menu, MenuItem, Tooltip, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { AboutModal } from '../../composer/components/AboutModal';
import { isDesktopRuntime } from '../../lib/desktopExport';
import type { StudioThemePreference } from '../useStudioTheme';
import { variantLabel } from '../variantLabels';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioMainMenu, type StudioMenuDialog } from './StudioMainMenu';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';

const THEMES: Array<{ id: StudioThemePreference; label: string }> = [
  { id: 'dark', label: 'Dark theme' },
  { id: 'light', label: 'Light theme' },
  { id: 'system', label: 'System theme' }
];

interface StudioTitleBarProps {
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
}

const themeIcon = (preference: StudioThemePreference) =>
  preference === 'light' ? <Sun size={16} /> : preference === 'system' ? <Monitor size={16} /> : <Moon size={16} />;

/**
 * Studio titlebar (chrome slice): the full-width frame — brand, software
 * menus, document breadcrumb — with ONLY theme and shortcuts on the right,
 * plus the reserved Tauri window-button zone (never a functional control).
 *
 * Panel toggles live at the canvas bar edges, Insert lives only in the Layers
 * header, View options lives in the canvas bar, and Export lives in the
 * Inspector Export tab: nothing functional is duplicated here.
 */
export const StudioTitleBar = ({ themePreference, onThemePreference, onOpenShortcuts }: StudioTitleBarProps) => {
  const { state, dispatch, navigate } = useComposer();
  const [menuDialog, setMenuDialog] = useState<StudioMenuDialog>(null);
  const project = state.project;

  // The desktop shell draws its window buttons over the titlebar's right end:
  // the reserve zone keeps theme/shortcuts clear of them. Web browsers own
  // their chrome outside the page, so the zone stays collapsed there.
  useEffect(() => {
    if (isDesktopRuntime()) document.documentElement.setAttribute('data-tauri', '');
  }, []);

  return (
    <>
      <header className="studio-titlebar">
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
        <StudioMainMenu
          onDialog={(dialog) => {
            if (dialog === 'shortcuts') onOpenShortcuts();
            else setMenuDialog(dialog);
          }}
        />
        <div className="studio-doc" aria-live="polite">
          <Box size={13} aria-hidden="true" />
          <strong>{project?.metadata.name ?? 'No document'}</strong>
          {state.isDirty && <span className="studio-doc-unsaved" aria-label="Unsaved changes" />}
          <ChevronRight size={12} aria-hidden="true" />
          <span>{variantLabel(state.activeVariant)}</span>
        </div>
        <div className="studio-titlebar-actions">
          <Menu
            label="Theme"
            trigger={
              <span className="inline-flex">
                <Tooltip content="Theme">
                  <IconButton icon={themeIcon(themePreference)} aria-label={`Theme: ${themePreference}`} />
                </Tooltip>
              </span>
            }
          >
            {THEMES.map((theme) => (
              <MenuItem
                key={theme.id}
                label={theme.label}
                icon={themePreference === theme.id ? <Check size={14} /> : undefined}
                onSelect={() => onThemePreference(theme.id)}
              />
            ))}
          </Menu>
          <Tooltip content="Keyboard shortcuts (?)">
            <IconButton icon={<Keyboard size={16} />} aria-label="Keyboard shortcuts" onClick={onOpenShortcuts} />
          </Tooltip>
          <div className="studio-tauri-zone" aria-hidden="true" />
        </div>
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
