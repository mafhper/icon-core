import { useState } from 'react';
import {
  ArrowUpToLine,
  Box,
  Check,
  ChevronRight,
  Keyboard,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Sun,
  Undo2
} from 'lucide-react';
import { IconButton, Menu, MenuItem, Tooltip, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { AboutModal } from '../../composer/components/AboutModal';
import type { StudioThemePreference } from '../useStudioTheme';
import { variantLabel } from '../variantLabels';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioInsertMenu } from './StudioInsertMenu';
import { StudioMainMenu, type StudioMenuDialog } from './StudioMainMenu';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';
import { StudioViewOptions } from './StudioViewOptions';

const THEMES: Array<{ id: StudioThemePreference; label: string }> = [
  { id: 'dark', label: 'Dark theme' },
  { id: 'light', label: 'Light theme' },
  { id: 'system', label: 'System theme' }
];

interface StudioTopBarProps {
  leftOpen: boolean;
  inspectorOpen: boolean;
  onToggleLeft: () => void;
  onToggleInspector: () => void;
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
  onResetView: () => void;
}

const themeIcon = (preference: StudioThemePreference) =>
  preference === 'light' ? <Sun size={16} /> : preference === 'system' ? <Monitor size={16} /> : <Moon size={16} />;

/**
 * Studio top chrome (chrome slice): titlebar (brand + software menus +
 * document breadcrumb) over the toolbar (undo/redo, insert, view options,
 * panel toggles, theme, export).
 *
 * The document breadcrumb (name › variant) lives here, not in the canvas —
 * and View options lives in this toolbar, not over the viewport. Variant
 * selection itself stays only in the canvas tiles (and the Inspector Preview
 * grid, which renders the same tiles) — never in this toolbar.
 *
 * Every control acts from day one: the menus open real dialogs, Insert
 * dispatches real layers, and View options flips real viewport flags.
 */
export const StudioTopBar = ({
  leftOpen,
  inspectorOpen,
  onToggleLeft,
  onToggleInspector,
  themePreference,
  onThemePreference,
  onOpenShortcuts,
  onResetView
}: StudioTopBarProps) => {
  const { state, dispatch, navigate } = useComposer();
  const [menuDialog, setMenuDialog] = useState<StudioMenuDialog>(null);
  const project = state.project;
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

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
          <Tooltip content={leftOpen && inspectorOpen ? 'Minimize panels' : 'Restore panels'}>
            <IconButton
              icon={leftOpen && inspectorOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              aria-label={leftOpen && inspectorOpen ? 'Minimize panels' : 'Restore panels'}
              onClick={() => {
                if (leftOpen && inspectorOpen) {
                  onToggleLeft();
                  onToggleInspector();
                } else {
                  if (!leftOpen) onToggleLeft();
                  if (!inspectorOpen) onToggleInspector();
                }
              }}
            />
          </Tooltip>
        </div>
      </header>
      <div className="studio-topbar" role="toolbar" aria-label="Studio toolbar">
        <div className="studio-topbar-group">
          <Tooltip content="Undo (Ctrl+Z)">
            <IconButton
              icon={<Undo2 size={16} />}
              aria-label="Undo"
              disabled={!canUndo}
              onClick={() => dispatch({ type: 'UNDO' })}
            />
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z)">
            <IconButton
              icon={<Redo2 size={16} />}
              aria-label="Redo"
              disabled={!canRedo}
              onClick={() => dispatch({ type: 'REDO' })}
            />
          </Tooltip>
        </div>
        <span className="studio-divider" aria-hidden="true" />
        <div className="studio-topbar-group">
          <StudioInsertMenu variant="primary" />
          <StudioViewOptions onResetView={onResetView} />
        </div>
        {/* Variant lives only in the canvas tiles (and the Inspector
            Preview grid, which renders the same tiles): no topbar duplicate. */}
        <div className="studio-topbar-spacer" />
        <div className="studio-topbar-group">
          <Tooltip content={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}>
            <IconButton
              icon={leftOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              aria-label={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}
              aria-pressed={leftOpen}
              onClick={onToggleLeft}
            />
          </Tooltip>
          <Tooltip content={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}>
            <IconButton
              icon={inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              aria-label={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}
              aria-pressed={inspectorOpen}
              onClick={onToggleInspector}
            />
          </Tooltip>
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
        </div>
        <span className="studio-divider" aria-hidden="true" />
        <button type="button" className="studio-export-button" onClick={() => navigate('export-utilities')}>
          <ArrowUpToLine size={14} aria-hidden="true" />
          <span>Export</span>
        </button>
      </div>
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
