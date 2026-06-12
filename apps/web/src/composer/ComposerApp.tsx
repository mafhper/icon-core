import { ComposerProvider, useComposer } from './ComposerContext';
import { ComposeView } from './views/ComposeView';
import { ExportView } from './views/ExportView';
import { CommandPalette } from './components/CommandPalette';
import { WorkspacesView } from './views/WorkspacesView';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const ComposerShell = () => {
  const { state } = useComposer();
  useKeyboardShortcuts();

  if (state.view === 'workspaces' || !state.project) {
    return <WorkspacesView />;
  }

  if (state.view === 'export-utilities') {
    return <ExportView />;
  }

  return (
    <>
      <ComposeView />
      <CommandPalette />
    </>
  );
};

export const ComposerApp = () => {
  return (
    <ComposerProvider>
      <div className="min-h-screen text-core-text bg-core-bg composer-enter">
        <ComposerShell />
      </div>
    </ComposerProvider>
  );
};
