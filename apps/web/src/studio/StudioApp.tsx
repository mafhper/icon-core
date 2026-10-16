import { useCallback, useEffect, useState } from 'react';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../composer/ComposerContext';
import { UiGallery } from '../composer/views/UiGallery';
import { CommandPalette } from '../composer/components/CommandPalette';
import { PanelResizer } from '../composer/components/PanelResizer';
import { WelcomeModal } from '../composer/components/WelcomeModal';
import { useKeyboardShortcuts } from '../composer/hooks/useKeyboardShortcuts';
import { usePanelLayout } from '../composer/hooks/usePanelLayout';
import { ToastProvider } from '../composer/toast/ToastContext';
import { ToastViewport } from '../composer/toast/ToastViewport';
import { StudioTopBar } from './components/StudioTopBar';
import { StudioLayersPanel } from './components/StudioLayersPanel';
import { StudioCanvasStage } from './components/StudioCanvasStage';
import { StudioExportDialog } from './components/StudioExportDialog';
import { StudioInspectorPanel } from './components/StudioInspectorPanel';
import { StudioShortcutsDialog } from './components/StudioShortcutsDialog';
import { StudioStatusBar, type StudioTool } from './components/StudioStatusBar';
import {
  readThemePreference,
  useStudioTheme,
  writeThemePreference,
  type StudioThemePreference
} from './useStudioTheme';
import './studio.css';

/**
 * Studio shell (rebuild limpo, Fases 1–3): five regions over the real engine.
 *
 * The state, history, canvas pipeline and inspector are the Composer's —
 * `ComposerProvider`, the reducer actions, `PreviewCanvas`, `LayerList` and
 * `LayerInspector` — so Layers → Canvas → Inspector are synchronised by
 * construction from the first commit. What is new is the chrome: titlebar,
 * toolbar, resizable side panels (205–380px, independently collapsible with
 * an always-visible way back), the canvas stage (breadcrumb, View options,
 * Hand pan, pill, live variant tiles) and the three-zone statusbar, all
 * under the `[data-theme]` contract, dark-first.
 *
 * Project-independent surfaces keep their contracts: `#/ui` renders the
 * gallery alone (never under the welcome modal), and the export-utilities
 * view stays reachable until Fase 5 replaces it with the studio dialog.
 */
export const StudioShell = () => {
  const { state, navigate } = useComposer();
  const [tool, setTool] = useState<StudioTool>('select');
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<StudioThemePreference>(readThemePreference);
  useKeyboardShortcuts();
  useStudioTheme(themePreference);
  const {
    isLarge,
    leftWidth,
    rightWidth,
    leftOpen,
    inspectorOpen,
    toggleLeft,
    toggleInspector,
    startLeftResize,
    startRightResize
  } = usePanelLayout();

  // Figma tool keys the Composer never owned: `V` returns to Select, `H`
  // takes the Hand (pan). The Composer hook owns every other binding.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing) return;
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'v' || event.key === 'V') setTool('select');
      if (event.key === 'h' || event.key === 'H') setTool('hand');
      if (event.key === '?') setShortcutsOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const changeTheme = useCallback((preference: StudioThemePreference) => {
    writeThemePreference(preference);
    setThemePreference(preference);
  }, []);

  if (state.view === 'ui') {
    return <UiGallery />;
  }

  const showWelcome = !state.project || state.view === 'workspaces';

  return (
    <div className="studio">
      <StudioTopBar
        leftOpen={leftOpen}
        inspectorOpen={inspectorOpen}
        onToggleLeft={toggleLeft}
        onToggleInspector={toggleInspector}
        themePreference={themePreference}
        onThemePreference={changeTheme}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="studio-body">
          <section
            className="studio-panel studio-panel-left"
            aria-label="Layers panel"
            data-open={leftOpen}
            style={{ width: leftOpen ? leftWidth : 0 }}
          >
            <StudioLayersPanel />
          </section>
          {isLarge && leftOpen && (
            <PanelResizer side="left" label="Resize Layers panel" onStart={startLeftResize} />
          )}
          <StudioCanvasStage tool={tool} onTool={setTool} onCursor={setCursor} />
          {isLarge && inspectorOpen && (
            <PanelResizer side="right" label="Resize Inspector panel" onStart={startRightResize} />
          )}
          <section
            className="studio-panel studio-panel-right"
            aria-label="Inspector panel"
            data-open={inspectorOpen}
            style={{ width: inspectorOpen ? rightWidth : 0 }}
          >
            <StudioInspectorPanel />
          </section>
      </div>
      {state.view === 'export-utilities' && state.project && (
        <StudioExportDialog onClose={() => navigate('edit-space')} />
      )}
      <StudioStatusBar tool={tool} cursor={cursor} />
      {shortcutsOpen && <StudioShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {state.view !== 'export-utilities' && <CommandPalette />}
      {showWelcome && <WelcomeModal dismissible={Boolean(state.project)} />}
      <span className="sr-only" role="status">
        {state.isDirty ? 'You have unsaved changes' : ''}
      </span>
    </div>
  );
};

export const StudioApp = () => {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>
          <div className="min-h-screen text-ic-text bg-ic-bg">
            <StudioShell />
          </div>
        </ComposerProvider>
        <ToastViewport />
      </ToastProvider>
    </TooltipProvider>
  );
};
