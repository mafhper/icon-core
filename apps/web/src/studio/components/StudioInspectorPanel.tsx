import { useState } from 'react';
import { LayerInspector } from '../../composer/components/LayerInspector';
import { StudioVariantTiles } from './StudioVariantTiles';

type InspectorTab = 'design' | 'preview';

/**
 * Studio Inspector panel (Fase 4): Design and Preview tabs.
 *
 * Design is the full `LayerInspector` — Geometry (now with corner
 * smoothing), the new Stroke section (width that never stretches the shape,
 * alignment, caps and joins in both engines), Color, Effects (now with
 * drop/inner shadows and the glow preset) — and, with nothing selected, the
 * document sections. Preview renders the four variants live through the same
 * tiles the canvas stage uses.
 */
export const StudioInspectorPanel = () => {
  const [tab, setTab] = useState<InspectorTab>('design');

  return (
    <>
      <div className="studio-tabs" role="tablist" aria-label="Inspector">
        {(['design', 'preview'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-active={tab === id}
            className="studio-tab"
            onClick={() => setTab(id)}
          >
            {id === 'design' ? 'Design' : 'Preview'}
          </button>
        ))}
      </div>
      {tab === 'design' ? (
        <div className="studio-panel-scroll">
          <LayerInspector />
        </div>
      ) : (
        <div className="studio-panel-scroll">
          <StudioVariantTiles grid />
        </div>
      )}
      {/* Mockup `inspector-foot`: static session line, no behaviour. */}
      <div className="studio-inspector-foot">
        <span className="studio-status-dot" aria-hidden="true" />
        <span>All changes in this session</span>
      </div>
    </>
  );
};
