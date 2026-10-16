import {
  ArrowUpToLine,
  Box,
  Check,
  ChevronDown,
  Circle,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Sun,
  Undo2
} from 'lucide-react';
import type { IconVariant } from '@iconcore/shared';
import { IconButton, Menu, MenuItem, Tooltip, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import type { StudioThemePreference } from '../useStudioTheme';

const VARIANTS: Array<{ id: IconVariant; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'mono', label: 'Monochrome' }
];

const THEMES: Array<{ id: StudioThemePreference; label: string }> = [
  { id: 'dark', label: 'Dark theme' },
  { id: 'light', label: 'Light theme' },
  { id: 'system', label: 'System theme' }
];

interface StudioTopBarProps {
  leftOpen: boolean;
  inspectorOpen: boolean;
  onToggleLeft: () => void;
  onToggleInspector: () => void;
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
}

const themeIcon = (preference: StudioThemePreference) =>
  preference === 'light' ? <Sun size={16} /> : preference === 'system' ? <Monitor size={16} /> : <Moon size={16} />;

/**
 * Studio top chrome (Fase 1): titlebar (brand + document + panel controls)
 * over the toolbar (undo/redo, appearance, panel toggles, theme, export).
 *
 * Every control acts from day one — there is no Insert menu yet (Fase 2) and
 * no rename/new-document entry points yet (Fase 5 brings the dialogs), so the
 * document name renders as text, not as a button that goes nowhere.
 */
export const StudioTopBar = ({
  leftOpen,
  inspectorOpen,
  onToggleLeft,
  onToggleInspector,
  themePreference,
  onThemePreference
}: StudioTopBarProps) => {
  const { state, dispatch, navigate } = useComposer();
  const project = state.project;
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;
  const activeVariant = state.activeVariant;
  const activeLabel = VARIANTS.find((variant) => variant.id === activeVariant)?.label ?? 'Default';

  return (
    <>
      <header className="studio-titlebar">
        <div className="studio-brand">
          {withIconStroke(<Box size={17} />, 'semibold')}
          <span>Icon-Core</span>
          <span className="studio-beta">BETA</span>
        </div>
        <div className="studio-doc" aria-live="polite">
          <strong>{project?.metadata.name ?? 'No document'}</strong>
          {state.isDirty && <span className="studio-doc-unsaved" aria-label="Unsaved changes" />}
        </div>
        <div className="studio-titlebar-actions">
          <Tooltip content={leftOpen && inspectorOpen ? 'Minimize panels' : 'Restore panels'}>
            <IconButton
              icon={leftOpen && inspectorOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              aria-label={leftOpen && inspectorOpen ? 'Minimize panels' : 'Restore panels'}
              onClick={() => {
                if (leftOpen && inspectorOpen) {
                  onToggleLeft();
                  onToggleInspector();
                } else {
                  if (!leftOpen) onToggleLeft();
                  if (!inspectorOpen) onToggleInspector();
                }
              }}
            />
          </Tooltip>
        </div>
      </header>
      <div className="studio-topbar" role="toolbar" aria-label="Studio toolbar">
        <div className="studio-topbar-group">
          <Tooltip content="Undo (Ctrl+Z)">
            <IconButton
              icon={<Undo2 size={16} />}
              aria-label="Undo"
              disabled={!canUndo}
              onClick={() => dispatch({ type: 'UNDO' })}
            />
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z)">
            <IconButton
              icon={<Redo2 size={16} />}
              aria-label="Redo"
              disabled={!canRedo}
              onClick={() => dispatch({ type: 'REDO' })}
            />
          </Tooltip>
        </div>
        <span className="studio-divider" aria-hidden="true" />
        <div className="studio-topbar-group">
          <span className="text-xs text-ic-text-muted" aria-hidden="true">
            Appearance
          </span>
          <Menu
            label="Appearance variant"
            trigger={
              <button type="button" className="studio-tab" aria-label={`Appearance: ${activeLabel}`}>
                <span className="inline-flex items-center gap-1.5">
                  <Circle size={12} aria-hidden="true" />
                  {activeLabel}
                  <ChevronDown size={12} aria-hidden="true" />
                </span>
              </button>
            }
          >
            {VARIANTS.map((variant) => (
              <MenuItem
                key={variant.id}
                label={variant.label}
                icon={activeVariant === variant.id ? <Check size={14} /> : <Circle size={12} />}
                onSelect={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variant.id })}
              />
            ))}
          </Menu>
        </div>
        <div className="studio-topbar-spacer" />
        <div className="studio-topbar-group">
          <Tooltip content={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}>
            <IconButton
              icon={leftOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              aria-label={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}
              aria-pressed={leftOpen}
              onClick={onToggleLeft}
            />
          </Tooltip>
          <Tooltip content={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}>
            <IconButton
              icon={inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              aria-label={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}
              aria-pressed={inspectorOpen}
              onClick={onToggleInspector}
            />
          </Tooltip>
          <Menu
            label="Theme"
            trigger={
              <span className="inline-flex">
                <Tooltip content="Theme">
                  <IconButton icon={themeIcon(themePreference)} aria-label={`Theme: ${themePreference}`} />
                </Tooltip>
              </span>
            }
          >
            {THEMES.map((theme) => (
              <MenuItem
                key={theme.id}
                label={theme.label}
                icon={themePreference === theme.id ? <Check size={14} /> : undefined}
                onSelect={() => onThemePreference(theme.id)}
              />
            ))}
          </Menu>
        </div>
        <span className="studio-divider" aria-hidden="true" />
        <button type="button" className="studio-export-button" onClick={() => navigate('export-utilities')}>
          <ArrowUpToLine size={14} aria-hidden="true" />
          <span>Export</span>
        </button>
      </div>
    </>
  );
};
