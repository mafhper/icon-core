import { useState } from 'react';
import { LayerInspector } from '../../composer/components/LayerInspector';
import { StudioExportPanel } from './StudioExportPanel';

type InspectorTab = 'design' | 'export';

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
 */
export const StudioInspectorPanel = () => {
  const [tab, setTab] = useState<InspectorTab>('design');

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
            onClick={() => setTab(id)}
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
