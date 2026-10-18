import { LayerInspector } from '../../composer/components/LayerInspector';
import { StudioExportPanel } from './StudioExportPanel';

export type InspectorTab = 'design' | 'export';

/**
 * Studio Inspector panel: Design and Export tabs.
 *
 * Design is the full `LayerInspector` — Position (X/Y plus W/H for shapes,
 * now Rotation before Scale), Geometry (shape, corner radius/smoothing),
 * Appearance (blend, opacity), Fill, Stroke (color first; lines also expose
 * width and color besides Cap), Effects — then Text only with text selected,
 * and, with nothing selected, the document sections. Layer meta and Delete
 * come last. Constraints/Layout/Mask do not exist in the model and are marked
 * as an explicit deferral, not invented.
 *
 * Export is `StudioExportPanel`: the export stages (configure → progress →
 * done/error) live in this tab, with the morphing footer at the end — the
 * topbar Export button is gone, this is its home.
 *
 * The tab is **controlled**: the shell owns the selection so every export entry
 * (main menu, `Ctrl+E`, command palette, welcome upload, legacy deep-link) can
 * land here through `EXPORT_FOCUS_EVENT` — one surface, and no dialog or
 * parallel view to keep in sync.
 */
export const StudioInspectorPanel = ({ tab, onTab }: { tab: InspectorTab; onTab: (tab: InspectorTab) => void }) => {
  return (
    <>
      <div className="studio-tabs" role="tablist" aria-label="Inspector">
        {(['design', 'export'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-active={tab === id}
            className="studio-tab"
            onClick={() => onTab(id)}
          >
            {id === 'design' ? 'Design' : 'Export'}
          </button>
        ))}
      </div>
      {tab === 'design' ? (
        <div className="studio-panel-scroll">
          <LayerInspector />
        </div>
      ) : (
        <StudioExportPanel />
      )}
      {/* Mockup `inspector-foot`: static session line, no behaviour. */}
      <div className="studio-inspector-foot">
        <span className="studio-status-dot" aria-hidden="true" />
        <span>All changes in this session</span>
      </div>
    </>
  );
};
