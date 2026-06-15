import { ComposerProvider, useComposer } from './ComposerContext';
import { ComposeView } from './views/ComposeView';
import { ExportView } from './views/ExportView';
import { CommandPalette } from './components/CommandPalette';
import { WelcomeModal } from './components/WelcomeModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ToastProvider } from './toast/ToastContext';
import { ToastViewport } from './toast/ToastViewport';

const ComposerShell = () => {
  const { state } = useComposer();
  useKeyboardShortcuts();

  // The editor is always mounted; the welcome experience is a modal layered on
  // top of it — shown automatically when there is no project, and on demand
  // (dismissible) when navigating Home with a project open.
  const showWelcome = !state.project || state.view === 'workspaces';

  return (
    <>
      {state.view === 'export-utilities' && state.project ? (
        <ExportView />
      ) : (
        <>
          <ComposeView />
          <CommandPalette />
        </>
      )}
      {showWelcome && <WelcomeModal dismissible={Boolean(state.project)} />}
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
