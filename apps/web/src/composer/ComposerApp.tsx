import { ComposerProvider, useComposer } from './ComposerContext';
import { Topbar } from './components/Topbar';
import { LayerList } from './components/LayerList';
import { LayerInspector } from './components/LayerInspector';
import { PreviewCanvas } from './components/PreviewCanvas';
import { SizeStrip } from './components/SizeStrip';
import { StartView } from './views/StartView';
import { ComposeView } from './views/ComposeView';
import { ExportView } from './views/ExportView';
import { CommandPalette } from './components/CommandPalette';
import { PresetsCatalog } from './components/PresetsCatalog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useState } from 'react';

const ComposerShell = () => {
  const { state } = useComposer();
  useKeyboardShortcuts();
  const [showPresets, setShowPresets] = useState(false);

  if (state.view === 'start' || !state.project) {
    return <StartView onOpenPresets={() => setShowPresets(true)} />;
  }

  if (state.view === 'export') {
    return <ExportView />;
  }

  return (
    <>
      <ComposeView />
      <CommandPalette />
      {showPresets && <PresetsCatalog onClose={() => setShowPresets(false)} />}
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