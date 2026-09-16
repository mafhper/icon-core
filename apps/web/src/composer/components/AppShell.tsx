import type React from 'react';
import { Topbar } from './Topbar';
import { ToolRail } from './ToolRail';
import { ActionBar } from './ActionBar';
import { LayerList } from './LayerList';
import { LayerInspector } from './LayerInspector';
import { PreviewCanvas } from './PreviewCanvas';
import { PanelResizer } from './PanelResizer';
import { usePanelLayout } from '../hooks/usePanelLayout';

/**
 * Composer AppShell.
 *
 * PR-05 introduced the zoned layout; PR-06 added responsive collapse; PR-08
 * v2 replaces overlays with always-visible side panels that each collapse
 * independently:
 * - Layers (left) and Inspector (right) are permanent columns at every
 *   viewport width.
 * - Each panel collapses to zero width from its own toggle; the canvas simply
 *   reflows into the freed space — nothing is covered or pushed around.
 * - Panel widths are resizable (large viewports) and persisted to localStorage.
 */
export const AppShell = () => {
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

  const shellClass = isLarge ? 'is-large' : 'is-medium';

  return (
    <div
      className={`ic-app-shell ${shellClass}`}
      style={
        {
          '--panel-left': leftOpen ? `${leftWidth}px` : '0px',
          '--panel-right': inspectorOpen ? `${rightWidth}px` : '0px'
        } as React.CSSProperties
      }
    >
      <Topbar />
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
        </div>
        <section
          className="ic-app-panel ic-right-panel"
          aria-label="Inspector panel"
          data-open={inspectorOpen ? '' : undefined}
        >
          <LayerInspector />
        </section>
      </div>
      <ActionBar
        onToggleLeft={toggleLeft}
        leftOpen={leftOpen}
        showLeftToggle
        onToggleInspector={toggleInspector}
        inspectorOpen={inspectorOpen}
        showInspectorToggle
      />
    </div>
  );
};