import { ChevronDown, Settings2 } from 'lucide-react';
import { Menu, MenuItem } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';

const check = (on: boolean) => (on ? 'On' : 'Off');

/**
 * Studio View options (chrome slice): the canvas overlay menu in its topbar
 * home. Every row flips a real Composer flag; Reset view returns zoom and pan
 * together through the shell callback, so the topbar never owns viewport state.
 */
export const StudioViewOptions = ({ onResetView }: { onResetView: () => void }) => {
  const { state, dispatch } = useComposer();

  return (
    <Menu
      label="View options"
      trigger={
        <button type="button" className="studio-trigger" aria-label="View options">
          <span className="inline-flex items-center gap-1.5">
            <Settings2 size={14} aria-hidden="true" />
            <span>View options</span>
            <ChevronDown size={12} aria-hidden="true" />
          </span>
        </button>
      }
    >
      <MenuItem
        label={`Grid — ${check(state.showGrid)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_GRID' })}
      />
      <MenuItem
        label={`Keylines — ${check(state.showKeylines)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
      />
      <MenuItem
        label={`Import margin — ${check(state.showMarginOverlay)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_MARGIN_OVERLAY' })}
      />
      <MenuItem
        label={`Safe area — ${check(state.showSafeArea)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_SAFE_AREA' })}
      />
      <MenuItem
        label={`Icon mask — ${check(state.showMask)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_MASK' })}
      />
      <MenuItem
        label={`Snapping guides — ${check(state.showSnapping)}`}
        onSelect={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
      />
      <MenuItem label="Reset view" onSelect={onResetView} />
    </Menu>
  );
};
