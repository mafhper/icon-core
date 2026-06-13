import { ComposerProvider, useComposer } from './ComposerContext';
import { ComposeView } from './views/ComposeView';
import { ExportView } from './views/ExportView';
import { CommandPalette } from './components/CommandPalette';
import { WorkspacesView } from './views/WorkspacesView';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ToastProvider } from './toast/ToastContext';
import { ToastViewport } from './toast/ToastViewport';

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
    <ToastProvider>
      <ComposerProvider>
        <div className="min-h-screen text-core-text bg-core-bg composer-enter">
          <ComposerShell />
        </div>
      </ComposerProvider>
      <ToastViewport />
    </ToastProvider>
  );
};
