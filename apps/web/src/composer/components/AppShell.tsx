import { Topbar } from './Topbar';
import { ToolRail } from './ToolRail';
import { ActionBar } from './ActionBar';
import { LayerList } from './LayerList';
import { LayerInspector } from './LayerInspector';
import { PreviewCanvas } from './PreviewCanvas';
import { AppearanceBar } from './AppearanceBar';

/**
 * Composer AppShell (PR-05).
 *
 * Zoned layout: header (project identity/file actions) → tool rail + left
 * panel (Layers) + staging/main (canvas + appearance) + right panel
 * (Inspector) → contextual action bar. The existing panels are migrated into
 * their zones unchanged; denser interaction primitives arrive in PR-07+.
 */
export const AppShell = () => {
  return (
    <div className="ic-app-shell">
      <Topbar />
      <div className="ic-app-body">
        <ToolRail />
        <section className="ic-app-panel" aria-label="Layers panel">
          <LayerList />
        </section>
        <div className="ic-app-main">
          <PreviewCanvas />
          <AppearanceBar />
        </div>
        <section className="ic-app-panel" aria-label="Inspector panel">
          <LayerInspector />
        </section>
      </div>
      <ActionBar />
    </div>
  );
};