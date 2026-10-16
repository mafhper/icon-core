import { Kbd } from '@iconcore/ui';
import { StudioDialog } from './StudioDialog';

interface ShortcutGroup {
  title: string;
  rows: Array<{ keys: string[]; action: string }>;
}

/**
 * Studio keyboard shortcuts (Fase 2): the real list.
 *
 * Every row names a binding the app actually installs — the Composer's
 * `useKeyboardShortcuts` plus the studio tool keys (`V`/`H`) owned by the
 * shell. `Menu` shortcut labels point here, and this dialog is the proof
 * they do not lie.
 */
const GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    rows: [
      { keys: ['V'], action: 'Select tool' },
      { keys: ['H'], action: 'Hand tool (pan)' }
    ]
  },
  {
    title: 'Layers',
    rows: [
      { keys: ['Delete', 'Backspace'], action: 'Delete selected layer' },
      { keys: ['Ctrl', 'D'], action: 'Duplicate selected layer' },
      { keys: ['↑', '↓', '←', '→'], action: 'Nudge selected layer (Shift: ×10)' }
    ]
  },
  {
    title: 'History',
    rows: [
      { keys: ['Ctrl', 'Z'], action: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' }
    ]
  },
  {
    title: 'View',
    rows: [
      { keys: ['Ctrl', '+'], action: 'Zoom in' },
      { keys: ['Ctrl', '−'], action: 'Zoom out' },
      { keys: ['Ctrl', '0'], action: 'Reset zoom' },
      { keys: ['G'], action: 'Toggle grid' },
      { keys: ['1', '2', '3'], action: 'Default / Light / Dark variant' }
    ]
  },
  {
    title: 'Document',
    rows: [
      { keys: ['Ctrl', 'S'], action: 'Save' },
      { keys: ['Ctrl', 'E'], action: 'Open export' },
      { keys: ['Ctrl', 'L'], action: 'Add circle layer' },
      { keys: ['Esc'], action: 'Deselect layer / close dialog' },
      { keys: ['?'], action: 'Open this list' }
    ]
  }
];

export const StudioShortcutsDialog = ({ onClose }: { onClose: () => void }) => {
  return (
    <StudioDialog title="Keyboard shortcuts" onClose={onClose}>
      {GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="text-xs font-semibold text-ic-text-muted mt-3 mb-1">{group.title}</h3>
          <div className="studio-shortcut-list">
            {group.rows.map((row) => (
              <div className="studio-shortcut-row" key={row.action}>
                <span>{row.action}</span>
                <span className="inline-flex gap-1">
                  {row.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </StudioDialog>
  );
};
