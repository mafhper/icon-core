import { Download, FilePlus, Keyboard, PenLine, Save, Settings2 } from 'lucide-react';
import { IconButton, Menu, MenuItem, MenuSeparator, Tooltip } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';

export type StudioMenuDialog = 'new' | 'rename' | 'preferences' | 'shortcuts' | 'confirm-new' | null;

/**
 * Studio main menu (Fase 5): every document-level action in one place.
 *
 * New document is destructive (the autosave overwrites the stored copy with
 * the blank project, and nothing archives the old one first), so it asks
 * through the shared confirm dialog instead of dispatching directly. Save
 * writes through the provider's `saveProject` — in place when a file handle
 * is held, "as" otherwise — never a hand-rolled download.
 */
export const StudioMainMenu = ({ onDialog }: { onDialog: (dialog: Exclude<StudioMenuDialog, null>) => void }) => {
  const { state, saveProject, navigate } = useComposer();
  const hasProject = Boolean(state.project);

  return (
    <Menu
      label="Main menu"
      trigger={
        <span className="inline-flex">
          <Tooltip content="Main menu">
            <IconButton icon={<FilePlus size={16} />} aria-label="Main menu" />
          </Tooltip>
        </span>
      }
    >
      <MenuItem icon={<FilePlus size={14} />} label="New document…" onSelect={() => onDialog(hasProject ? 'confirm-new' : 'new')} />
      <MenuItem
        icon={<PenLine size={14} />}
        label="Rename document…"
        disabled={!hasProject}
        onSelect={() => onDialog('rename')}
      />
      <MenuItem icon={<Save size={14} />} label="Save session" shortcut="Ctrl+S" disabled={!hasProject} onSelect={() => void saveProject()} />
      <MenuItem icon={<Download size={14} />} label="Export icons…" disabled={!hasProject} onSelect={() => navigate('export-utilities')} />
      <MenuSeparator />
      <MenuItem icon={<Settings2 size={14} />} label="Preferences…" onSelect={() => onDialog('preferences')} />
      <MenuItem icon={<Keyboard size={14} />} label="Keyboard shortcuts" shortcut="?" onSelect={() => onDialog('shortcuts')} />
    </Menu>
  );
};
