import { useState, useEffect, useRef } from 'react';
import { useComposer } from '../ComposerContext';

interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'layers' | 'edit' | 'view' | 'export';
}

export const CommandPalette = () => {
  const { state, dispatch, navigate } = useComposer();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    {
      id: 'new-project',
      label: 'Workspaces',
      description: 'Return to Workspaces',
      shortcut: '⌘N',
      category: 'navigation',
      action: () => navigate('workspaces')
    },
    {
      id: 'open-project',
      label: 'Open Project',
      description: 'Open an existing .iconcore.json file',
      shortcut: '⌘O',
      category: 'navigation',
      action: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.iconcore.json,.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const text = await file.text();
          try {
            const project = JSON.parse(text);
            dispatch({ type: 'LOAD_PROJECT', payload: project });
          } catch (err) {
            console.error('Failed to parse project file:', err);
          }
        };
        input.click();
      }
    },
    {
      id: 'save-project',
      label: 'Save Project',
      description: 'Download project as .iconcore.json',
      shortcut: '⌘S',
      category: 'navigation',
      action: () => {
        if (!state.project) return;
        const json = JSON.stringify(state.project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.project.metadata.name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;
        a.click();
        URL.revokeObjectURL(url);
        dispatch({ type: 'SET_DIRTY', payload: false });
      }
    },
    {
      id: 'undo',
      label: 'Undo',
      description: 'Undo last action',
      shortcut: '⌘Z',
      category: 'edit',
      action: () => dispatch({ type: 'UNDO' })
    },
    {
      id: 'redo',
      label: 'Redo',
      description: 'Redo last undone action',
      shortcut: '⌘⇧Z',
      category: 'edit',
      action: () => dispatch({ type: 'REDO' })
    },
    {
      id: 'add-layer',
      label: 'Add Layer',
      description: 'Add a new shape layer',
      shortcut: '⌘L',
      category: 'layers',
      action: () => dispatch({ type: 'ADD_LAYER', payload: { shape: { kind: 'circle', width: 100, height: 100 } } })
    },
    {
      id: 'delete-layer',
      label: 'Delete Layer',
      description: 'Remove selected layer',
      shortcut: '⌫',
      category: 'layers',
      action: () => {
        if (state.activeLayerId) {
          dispatch({ type: 'REMOVE_LAYER', payload: { id: state.activeLayerId } });
        }
      }
    },
    {
      id: 'duplicate-layer',
      label: 'Duplicate Layer',
      description: 'Duplicate selected layer',
      shortcut: '⌘D',
      category: 'layers',
      action: () => {
        if (state.activeLayerId) {
          dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } });
        }
      }
    },
    {
      id: 'toggle-grid',
      label: 'Toggle Grid',
      description: 'Show/hide alignment grid',
      shortcut: 'G',
      category: 'view',
      action: () => dispatch({ type: 'TOGGLE_GRID' })
    },
    {
      id: 'zoom-in',
      label: 'Zoom In',
      description: 'Increase preview zoom',
      shortcut: '⌘+',
      category: 'view',
      action: () => dispatch({ type: 'SET_ZOOM', payload: Math.min(4, state.zoom + 0.25) })
    },
    {
      id: 'zoom-out',
      label: 'Zoom Out',
      description: 'Decrease preview zoom',
      shortcut: '⌘-',
      category: 'view',
      action: () => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.25, state.zoom - 0.25) })
    },
    {
      id: 'zoom-reset',
      label: 'Reset Zoom',
      description: 'Reset zoom to 100%',
      shortcut: '⌘0',
      category: 'view',
      action: () => dispatch({ type: 'SET_ZOOM', payload: 1 })
    },
    {
      id: 'mask-circle',
      label: 'Mask: Circle',
      description: 'Apply circular mask',
      category: 'view',
      action: () => dispatch({ type: 'SET_MASK_SHAPE', payload: 'circle' })
    },
    {
      id: 'mask-square',
      label: 'Mask: Square',
      description: 'Apply square mask',
      category: 'view',
      action: () => dispatch({ type: 'SET_MASK_SHAPE', payload: 'square' })
    },
    {
      id: 'mask-rounded',
      label: 'Mask: Rounded',
      description: 'Apply rounded rectangle mask',
      category: 'view',
      action: () => dispatch({ type: 'SET_MASK_SHAPE', payload: 'rounded-rectangle' })
    },
    {
      id: 'export',
      label: 'Open Export Utilities',
      description: 'Export icons for selected targets',
      shortcut: '⌘E',
      category: 'export',
      action: () => navigate('export-utilities')
    },
    {
      id: 'variant-default',
      label: 'Variant: Default',
      description: 'Switch to default variant',
      category: 'view',
      action: () => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'default' })
    },
    {
      id: 'variant-light',
      label: 'Variant: Light',
      description: 'Switch to light variant',
      category: 'view',
      action: () => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'light' })
    },
    {
      id: 'variant-dark',
      label: 'Variant: Dark',
      description: 'Switch to dark variant',
      category: 'view',
      action: () => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'dark' })
    }
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setSearch('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  const categories = ['navigation', 'edit', 'layers', 'view', 'export'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-2xl bg-core-surface border border-core-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-core-border">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="w-full px-4 py-3 bg-core-elevated border border-core-border rounded-xl text-sm focus:outline-none focus:border-core-accent"
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {categories.map(category => {
            const categoryCommands = filteredCommands.filter(cmd => cmd.category === category);
            if (categoryCommands.length === 0) return null;

            return (
              <div key={category} className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-core-muted">
                  {category}
                </div>
                {categoryCommands.map((cmd) => {
                  const globalIdx = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition ${
                        globalIdx === selectedIndex
                          ? 'bg-core-accent/20 text-core-accent'
                          : 'hover:bg-core-elevated text-core-text'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-core-muted mt-0.5">{cmd.description}</div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <div className="text-xs text-core-muted font-mono ml-4">{cmd.shortcut}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filteredCommands.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-core-muted">
              No commands found
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-core-border bg-core-elevated flex items-center justify-between text-xs text-core-muted">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-core-surface rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-core-surface rounded">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-core-surface rounded">Esc</kbd> Close</span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
};
