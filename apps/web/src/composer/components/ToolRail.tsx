import { MousePointer2, PenTool, GalleryVerticalEnd } from 'lucide-react';

/**
 * Vertical tool rail (~44px) from the Composer AppShell.
 *
 * PR-05 introduces the shell only: the Select tool is the active editor tool
 * (all canvas manipulation runs through it today). Edit Path and Icon Library
 * are declared as disabled affordances for their dedicated phases (PR-15 and
 * PR-10 respectively).
 */
export const ToolRail = () => {
  return (
    <nav className="ic-tool-rail" aria-label="Tool rail">
      <div className="ic-tool-rail-group">
        <button
          type="button"
          className="ic-tool-rail-button is-active"
          title="Select — move, scale and rotate layers"
          aria-label="Select tool"
          aria-pressed="true"
        >
          <MousePointer2 size={18} />
        </button>
      </div>

      <div className="ic-tool-rail-group">
        <button
          type="button"
          className="ic-tool-rail-button"
          disabled
          title="Edit Path — arriving in a later phase"
          aria-label="Edit Path tool (coming soon)"
        >
          <PenTool size={18} />
        </button>
        <button
          type="button"
          className="ic-tool-rail-button"
          disabled
          title="Icon Library — arriving in a later phase"
          aria-label="Icon Library (coming soon)"
        >
          <GalleryVerticalEnd size={18} />
        </button>
      </div>
    </nav>
  );
};