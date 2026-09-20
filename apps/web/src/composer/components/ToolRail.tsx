import { GalleryVerticalEnd, MousePointer2, PenTool } from 'lucide-react';
import { ButtonGroup, IconButton, Tooltip } from '@iconcore/ui';

/**
 * Vertical tool rail (~44px) from the Composer AppShell.
 *
 * PR-05 introduces the shell only: the Select tool is the active editor tool
 * (all canvas manipulation runs through it today). Edit Path and Icon Library
 * are declared as disabled affordances for their dedicated phases (PR-15 and
 * PR-10 respectively).
 *
 * A2: built from the action grammar (@iconcore/ui). Disabled affordances keep
 * a native `title` because Radix Tooltip does not open over a disabled trigger.
 */
export const ToolRail = () => {
  return (
    <nav className="ic-tool-rail" aria-label="Tool rail">
      <ButtonGroup className="ic-tool-rail-group">
        <Tooltip content="Select — move, scale and rotate layers">
          <IconButton
            variant="rail"
            selected
            icon={<MousePointer2 size={18} />}
            aria-label="Select tool"
          />
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup className="ic-tool-rail-group">
        <IconButton
          variant="rail"
          disabled
          icon={<PenTool size={18} />}
          title="Edit Path — arriving in a later phase"
          aria-label="Edit Path tool (coming soon)"
        />
        <IconButton
          variant="rail"
          disabled
          icon={<GalleryVerticalEnd size={18} />}
          title="Icon Library — arriving in a later phase"
          aria-label="Icon Library (coming soon)"
        />
      </ButtonGroup>
    </nav>
  );
};