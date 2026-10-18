import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react';
import {
  Box,
  Check,
  ChevronRight,
  Download,
  FilePlus,
  FileX2,
  Info,
  Keyboard,
  Monitor,
  Moon,
  MoreHorizontal,
  PenLine,
  Save,
  Settings2,
  Sun
} from 'lucide-react';
import { Menu, MenuItem, MenuSeparator, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { AboutModal } from '../../composer/components/AboutModal';
import { requestExportFocus } from '../../composer/utils/exportFocus';
import { modKey } from '../../composer/utils/platform';
import { isDesktopRuntime } from '../../lib/desktopExport';
import {
  EMPTY_BAR_OVERFLOW,
  reduceBarOverflow,
  type StudioBarActionId,
  type StudioBarOverflowState
} from '../barOverflow';
import type { StudioThemePreference } from '../useStudioTheme';
import { variantLabel } from '../variantLabels';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioNameDialog } from './StudioNameDialog';
import { StudioPreferencesDialog } from './StudioPreferencesDialog';

const THEMES: Array<{ id: StudioThemePreference; label: string }> = [
  { id: 'dark', label: 'Dark theme' },
  { id: 'light', label: 'Light theme' },
  { id: 'system', label: 'System theme' }
];

type StudioMenuDialog = 'new' | 'rename' | 'preferences' | 'confirm-new' | 'confirm-close' | 'about' | null;

interface StudioTitleBarProps {
  themePreference: StudioThemePreference;
  onThemePreference: (preference: StudioThemePreference) => void;
  onOpenShortcuts: () => void;
}

interface StudioBarAction {
  label: string;
  icon: ReactNode;
  /** Display only — the binding lives in `useKeyboardShortcuts`. */
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

type StudioBarGroupId = 'document' | 'output' | 'system';

/**
 * The bar's three groups, in the order they paint. Groups are a reading order,
 * not a collapse order — that one is `STUDIO_BAR_PRIORITY`, and it is what
 * decides which action leaves the bar first.
 *
 * Document and Output carry their labels (they are the high-frequency half and
 * a bare glyph for "Close" is a guess); System is icon-only, the convention the
 * window chrome already teaches.
 */
const GROUPS: ReadonlyArray<{
  id: StudioBarGroupId;
  label: string;
  iconOnly: boolean;
  actions: readonly StudioBarActionId[];
}> = [
  { id: 'document', label: 'Document', iconOnly: false, actions: ['new', 'rename', 'close'] },
  { id: 'output', label: 'Output', iconOnly: false, actions: ['save', 'export'] },
  { id: 'system', label: 'System', iconOnly: true, actions: ['theme', 'shortcuts', 'preferences', 'about'] }
];

const GROUP_BY_ACTION: Record<StudioBarActionId, StudioBarGroupId> = {
  new: 'document',
  rename: 'document',
  close: 'document',
  save: 'output',
  export: 'output',
  theme: 'system',
  shortcuts: 'system',
  preferences: 'system',
  about: 'system'
};

const themeIcon = (preference: StudioThemePreference) =>
  preference === 'light' ? <Sun size={16} /> : preference === 'system' ? <Monitor size={16} /> : <Moon size={16} />;

/**
 * Measures the bar and folds one action per pass until it fits.
 *
 * The walk itself is `reduceBarOverflow` (pure, spec'd); this hook owns the two
 * things that are not: reading the live layout (`scrollWidth > clientWidth`) and
 * noticing that the action leaving the bar was the focused one — otherwise the
 * fold would drop the focus on `<body>`.
 *
 * `ResizeObserver` is the trigger the decision asks for. jsdom has none (the app
 * specs run there), so the window `resize` listener is the fallback path, and it
 * is the same walk.
 */
const useBarOverflow = (barRef: RefObject<HTMLElement | null>) => {
  const [state, setState] = useState<StudioBarOverflowState>(EMPTY_BAR_OVERFLOW);
  const stateRef = useRef(state);
  const sendFocusToOverflow = useRef(false);

  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const width = bar.clientWidth;
    const previous = stateRef.current;
    const next = reduceBarOverflow(previous, { overflowing: bar.scrollWidth > width + 1, width });
    if (next === previous) return;

    const active = document.activeElement as HTMLElement | null;
    const leaving = active?.closest('[data-bar-action]')?.getAttribute('data-bar-action') ?? null;
    if (
      leaving !== null &&
      next.collapsed.includes(leaving as StudioBarActionId) &&
      !previous.collapsed.includes(leaving as StudioBarActionId)
    ) {
      sendFocusToOverflow.current = true;
    }

    stateRef.current = next;
    setState(next);
  }, [barRef]);

  // One step per committed state: the fold/unfold cascade converges and then
  // returns the same object, so this effect stops asking.
  useLayoutEffect(() => {
    measure();
  }, [state, measure]);

  useEffect(() => {
    const run = () => measure();
    window.addEventListener('resize', run);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && barRef.current) {
      observer = new ResizeObserver(run);
      observer.observe(barRef.current);
    }

    // Manrope settles after the first paint and label widths move with it.
    void document.fonts?.ready.then(run).catch(() => undefined);

    return () => {
      window.removeEventListener('resize', run);
      observer?.disconnect();
    };
  }, [barRef, measure]);

  return { state, sendFocusToOverflow };
};

/**
 * Studio titlebar (distributed): the document, the way out and the system, in
 * one bar.
 *
 * G1 Document (New / Rename / Close) sits by the brand, the breadcrumb takes the
 * middle and shrinks with an ellipsis, and the right end carries G2 Output
 * (Save session / Export icons — the high-frequency pair, the whole point of
 * moving them out of a menu) and G3 System (Theme / Shortcuts / Preferences /
 * About).
 *
 * Preferences and About are the tail of `STUDIO_BAR_PRIORITY`: they are the
 * first actions to fold, so a bar that has to give up width shows the same
 * system row it always did (Theme, Shortcuts, More actions) and the two land
 * one click away. A bar with room shows them — there is no rule saying the
 * system row must hide what fits.
 *
 * Width is measured, never breakpointed: whenever the bar overflows, the
 * lowest-priority action folds into `More actions` — same label, same icon,
 * same shortcut hint as the button it replaced — and the fold is undone the
 * moment the bar has room again. With nothing folded the trigger is not
 * rendered at all, so `⋯` never opens an empty menu. At the extreme the menu is
 * every action plus the theme choices, and the bar is the brand and `⋯`.
 *
 * The panel toggles stay at the canvas bar edges, Insert stays in the Layers
 * header, View options stays in the canvas bar and Export stays the Inspector
 * Export tab: this bar duplicates none of them.
 */
export const StudioTitleBar = ({ themePreference, onThemePreference, onOpenShortcuts }: StudioTitleBarProps) => {
  const { state, dispatch, navigate, saveProject } = useComposer();
  const [menuDialog, setMenuDialog] = useState<StudioMenuDialog>(null);
  const barRef = useRef<HTMLElement>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const { state: overflow, sendFocusToOverflow } = useBarOverflow(barRef);
  const project = state.project;
  const hasProject = Boolean(project);

  // The desktop shell draws its window buttons over the titlebar's right end:
  // the reserve zone keeps the actions clear of them. Web browsers own their
  // chrome outside the page, so the zone stays collapsed there.
  useEffect(() => {
    if (isDesktopRuntime()) document.documentElement.setAttribute('data-tauri', '');
  }, []);

  // A focused control that folds must not drop the focus on `<body>`: the
  // trigger that now holds the action takes it.
  useLayoutEffect(() => {
    if (!sendFocusToOverflow.current) return;
    sendFocusToOverflow.current = false;
    overflowTriggerRef.current?.focus();
  }, [overflow.collapsed, sendFocusToOverflow]);

  const mod = modKey();
  const actions: Record<Exclude<StudioBarActionId, 'theme'>, StudioBarAction> = {
    new: {
      label: 'New document',
      icon: <FilePlus size={14} />,
      run: () => setMenuDialog(hasProject ? 'confirm-new' : 'new')
    },
    rename: {
      label: 'Rename document',
      icon: <PenLine size={14} />,
      disabled: !hasProject,
      run: () => setMenuDialog('rename')
    },
    close: {
      label: 'Close document',
      icon: <FileX2 size={14} />,
      disabled: !hasProject,
      run: () => setMenuDialog('confirm-close')
    },
    save: {
      label: 'Save session',
      icon: <Save size={14} />,
      shortcut: `${mod}+S`,
      disabled: !hasProject,
      run: () => void saveProject()
    },
    export: {
      label: 'Export icons',
      icon: <Download size={14} />,
      shortcut: `${mod}+E`,
      disabled: !hasProject,
      run: () => {
        // Export is the Inspector tab: the bar takes the studio there.
        navigate('edit-space');
        requestExportFocus();
      }
    },
    shortcuts: {
      label: 'Keyboard shortcuts',
      icon: <Keyboard size={14} />,
      shortcut: '?',
      run: onOpenShortcuts
    },
    preferences: {
      label: 'Preferences',
      icon: <Settings2 size={14} />,
      run: () => setMenuDialog('preferences')
    },
    about: {
      label: 'About Icon-Core',
      icon: <Info size={14} />,
      run: () => setMenuDialog('about')
    }
  };

  const isFolded = (id: StudioBarActionId) => overflow.collapsed.includes(id);
  const visible = (group: (typeof GROUPS)[number]) => group.actions.filter((id) => !isFolded(id));
  // Menu order follows the bar, not the fold order: the person reads the menu
  // where the action used to be.
  const folded = GROUPS.flatMap((group) => group.actions).filter(isFolded);

  const barButton = (id: Exclude<StudioBarActionId, 'theme'>, iconOnly: boolean) => {
    const action = actions[id];
    return (
      <button
        key={id}
        type="button"
        className={iconOnly ? 'studio-bar-action studio-bar-icon' : 'studio-bar-action'}
        data-bar-action={id}
        aria-label={action.label}
        title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
        disabled={action.disabled}
        onClick={action.run}
      >
        {action.icon}
        {!iconOnly && <span>{action.label}</span>}
      </button>
    );
  };

  const themeTrigger = (iconOnly: boolean) => (
    <Menu
      key="theme"
      label="Theme"
      trigger={
        <button
          type="button"
          className={iconOnly ? 'studio-bar-action studio-bar-icon' : 'studio-bar-action'}
          data-bar-action="theme"
          aria-label={`Theme: ${themePreference}`}
          title="Theme"
        >
          {themeIcon(themePreference)}
          {!iconOnly && <span>Theme</span>}
        </button>
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
  );

  const documentGroup = visible(GROUPS[0]);
  const outputGroup = visible(GROUPS[1]);
  const systemGroup = visible(GROUPS[2]);

  return (
    <>
      <header className="studio-titlebar" ref={barRef}>
        <button
          type="button"
          className="studio-brand studio-brand-button"
          aria-label="Go to workspaces"
          title="Go to workspaces"
          onClick={() => navigate('workspaces')}
        >
          {withIconStroke(<Box size={17} />, 'semibold')}
          <span>Icon-Core</span>
          <span className="studio-beta">BETA</span>
        </button>
        {documentGroup.length > 0 && (
          <div className="studio-bar-group" role="group" aria-label="Document">
            {documentGroup.map((id) => barButton(id as Exclude<StudioBarActionId, 'theme'>, false))}
          </div>
        )}
        <div className="studio-doc" aria-live="polite">
          <Box size={13} aria-hidden="true" />
          <strong>{project?.metadata.name ?? 'No document'}</strong>
          {state.isDirty && <span className="studio-doc-unsaved" aria-label="Unsaved changes" />}
          <ChevronRight size={12} aria-hidden="true" />
          <span>{variantLabel(state.activeVariant)}</span>
        </div>
        <div className="studio-titlebar-actions">
          {outputGroup.length > 0 && (
            <div className="studio-bar-group" role="group" aria-label="Output">
              {outputGroup.map((id) => barButton(id as Exclude<StudioBarActionId, 'theme'>, false))}
            </div>
          )}
          {outputGroup.length > 0 && systemGroup.length > 0 && (
            <span className="studio-bar-divider" aria-hidden="true" />
          )}
          {(systemGroup.length > 0 || folded.length > 0) && (
            <div className="studio-bar-group" role="group" aria-label="System">
              {systemGroup.map((id) => (id === 'theme' ? themeTrigger(true) : barButton(id, true)))}
              {folded.length > 0 && (
                <Menu
                  label="More actions"
                  trigger={
                    <button
                      ref={overflowTriggerRef}
                      type="button"
                      className="studio-bar-action studio-bar-icon"
                      aria-label="More actions"
                      title="More actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  }
                >
                  {folded.map((id, index) => {
                    const separator = index > 0 && GROUP_BY_ACTION[folded[index - 1]] !== GROUP_BY_ACTION[id];
                    if (id === 'theme') {
                      return (
                        <Fragment key="theme">
                          {separator && <MenuSeparator />}
                          {THEMES.map((theme) => (
                            <MenuItem
                              key={theme.id}
                              label={theme.label}
                              icon={themePreference === theme.id ? <Check size={14} /> : undefined}
                              onSelect={() => onThemePreference(theme.id)}
                            />
                          ))}
                        </Fragment>
                      );
                    }
                    const action = actions[id];
                    return (
                      <Fragment key={id}>
                        {separator && <MenuSeparator />}
                        <MenuItem
                          icon={action.icon}
                          label={action.label}
                          shortcut={action.shortcut}
                          disabled={action.disabled}
                          onSelect={action.run}
                        />
                      </Fragment>
                    );
                  })}
                </Menu>
              )}
            </div>
          )}
          <div className="studio-tauri-zone" aria-hidden="true" />
        </div>
      </header>
      {menuDialog === 'confirm-new' && (
        <StudioConfirmDialog
          title="New document?"
          message="The current document will be replaced. The autosave stores the new blank project, so anything unsaved is gone — and it stays gone."
          confirmLabel="Discard and continue"
          onConfirm={() => setMenuDialog('new')}
          onCancel={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'new' && (
        <StudioNameDialog
          title="New document"
          description="A blank canvas at the size you pick."
          initialName="Untitled"
          submitLabel="Create document"
          sizes={[256, 512, 1024]}
          initialSize={project?.canvas.size ?? 512}
          onSubmit={(name, size) => {
            dispatch({ type: 'NEW_PROJECT', payload: { name, size: size ?? 512 } });
            navigate('edit-space');
            setMenuDialog(null);
          }}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'rename' && project && (
        <StudioNameDialog
          title="Rename document"
          initialName={project.metadata.name}
          submitLabel="Rename"
          onSubmit={(name) => {
            dispatch({ type: 'SET_PROJECT_NAME', payload: name });
            setMenuDialog(null);
          }}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'confirm-close' && (
        <StudioConfirmDialog
          title="Close this document?"
          message="The canvas clears and the project list opens. Anything already saved stays in the library."
          confirmLabel="Close document"
          onConfirm={() => {
            dispatch({ type: 'CLOSE_PROJECT' });
            navigate('workspaces');
            setMenuDialog(null);
          }}
          onCancel={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'preferences' && (
        <StudioPreferencesDialog
          preference={themePreference}
          onPreference={onThemePreference}
          onClose={() => setMenuDialog(null)}
        />
      )}
      {menuDialog === 'about' && <AboutModal onClose={() => setMenuDialog(null)} />}
    </>
  );
};
