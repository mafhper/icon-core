import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from './ComposerContext';
import { ComposeView } from './views/ComposeView';
import { ExportView } from './views/ExportView';
import { UiGallery } from './views/UiGallery';
import { CommandPalette } from './components/CommandPalette';
import { WelcomeModal } from './components/WelcomeModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './toast/ToastContext';
import { ToastViewport } from './toast/ToastViewport';

const ComposerShell = () => {
  const { state } = useComposer();
  useKeyboardShortcuts();
  useTheme();

  // The `#/ui` gallery is project-independent: it renders alone, never under
  // the welcome modal, so primitives are inspectable with zero setup.
  if (state.view === 'ui') {
    return <UiGallery />;
  }

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
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>
          <div className="min-h-screen text-ic-text bg-ic-bg composer-enter">
            <ComposerShell />
          </div>
        </ComposerProvider>
        <ToastViewport />
      </ToastProvider>
    </TooltipProvider>
  );
};
