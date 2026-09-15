import type React from 'react';
import { Topbar } from './Topbar';
import { ToolRail } from './ToolRail';
import { ActionBar } from './ActionBar';
import { LayerList } from './LayerList';
import { LayerInspector } from './LayerInspector';
import { PreviewCanvas } from './PreviewCanvas';
import { AppearanceBar } from './AppearanceBar';
import { PanelResizer } from './PanelResizer';
import { usePanelLayout } from '../hooks/usePanelLayout';

/**
 * Composer AppShell.
 *
 * PR-05 introduced the zoned layout; PR-06 adds responsive-by-collapse:
 * - >= 1180px: full columns (tool rail, Layers, staging, Inspector).
 * - 900–1179px: Inspector becomes a right-hand sheet (opens on demand).
 * - < 900px: Layers becomes a drawer (topbar hamburger) + the tool rail moves
 *   to the bottom edge; Inspector remains a sheet.
 * Panel widths are resizable and persisted to localStorage.
 */
export const AppShell = () => {
  const {
    isSmall,
    isMedium,
    isLarge,
    leftWidth,
    rightWidth,
    leftOpen,
    inspectorOpen,
    toggleLeft,
    toggleInspector,
    closePanels,
    startLeftResize,
    startRightResize,
    overlayBackdropVisible
  } = usePanelLayout();

  const shellClass = isSmall ? 'is-small' : isMedium ? 'is-medium' : 'is-large';

  return (
    <div
      className={`ic-app-shell ${shellClass}`}
      style={
        {
          '--panel-left': `${leftWidth}px`,
          '--panel-right': `${rightWidth}px`
        } as React.CSSProperties
      }
    >
      <Topbar
        onToggleLeft={toggleLeft}
        leftOpen={leftOpen}
        showLeftToggle={isSmall}
      />
      <div className="ic-app-body">
        <ToolRail />
        <section
          className="ic-app-panel ic-left-panel"
          aria-label="Layers panel"
          data-open={leftOpen ? '' : undefined}
        >
          <LayerList />
        </section>
        <div className="ic-app-main">
          {isLarge && <PanelResizer side="left" label="Resize Layers panel" onStart={startLeftResize} />}
          {isLarge && <PanelResizer side="right" label="Resize Inspector panel" onStart={startRightResize} />}
          <PreviewCanvas />
          <AppearanceBar />
        </div>
        <section
          className="ic-app-panel ic-right-panel"
          aria-label="Inspector panel"
          data-open={inspectorOpen ? '' : undefined}
        >
          <LayerInspector />
        </section>
      </div>
      {overlayBackdropVisible && (
        <div className="ic-app-backdrop" onClick={closePanels} aria-hidden="true" />
      )}
      <ActionBar
        onToggleInspector={toggleInspector}
        inspectorOpen={inspectorOpen}
        showInspectorToggle={!isLarge}
      />
    </div>
  );
};