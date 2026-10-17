import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../composer/ComposerContext';
import { ToastProvider } from '../composer/toast/ToastContext';
import { createBlankProject } from '../composer/utils/projectFactory';
import { StudioShell } from './StudioApp';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }
});

const renderShell = (node?: ReactNode) =>
  render(
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>{node ?? <StudioShell />}</ComposerProvider>
      </ToastProvider>
    </TooltipProvider>
  );

/** Loads a real project through the reducer so the shell has layers to show. */
const SeededShell = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioShell />;
};

describe('Studio layers + insert + shortcuts (Fase 2)', () => {
  it('inserts an ellipse through the primary Insert menu', () => {
    renderShell(<SeededShell project={createBlankProject('Insert', 512)} />);
    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('0');

    // The primary Insert lives in the toolbar (the panel header carries the same menu).
    // Radix opens dropdowns on pointer-down, not on click.
    const toolbar = screen.getByRole('toolbar', { name: 'Studio toolbar' });
    fireEvent.pointerDown(within(toolbar).getByRole('button', { name: 'Insert layer' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ellipse' }));

    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('1');
  });

  it('asks before a menu-driven delete, and removes on confirm', () => {
    const project = createBlankProject('Delete', 512);
    project.layers = [
      {
        id: 'layer-prism',
        name: 'Prism',
        kind: 'shape',
        visible: true,
        zIndex: 1,
        source: { type: 'inline', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#3f6ce0', alpha: 1 }
      }
    ];
    renderShell(<SeededShell project={project} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Prism' }));
    expect(screen.getByRole('dialog', { name: 'Delete layer?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete layer' }));
    expect(screen.queryByRole('dialog', { name: 'Delete layer?' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('0');
  });

  it('opens the real shortcut list and switches tools from the keyboard', () => {
    renderShell(<SeededShell project={createBlankProject('Keys', 512)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(dialog).getByText('Duplicate selected layer')).toBeInTheDocument();
    expect(within(dialog).getByText('Select tool')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toHaveTextContent('Hand');
    fireEvent.keyDown(window, { key: 'v' });
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toHaveTextContent('Select');
  });
});

describe('Studio canvas stage (Fase 3)', () => {
  const prism = (): IconLayer => ({
    id: 'layer-prism',
    name: 'Prism',
    kind: 'shape',
    visible: true,
    zIndex: 1,
    source: { type: 'inline', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    fill: { kind: 'solid', color: '#3f6ce0', alpha: 1 }
  });

  const openViewOptions = () => {
    // View options lives in the Studio toolbar, not over the viewport.
    const toolbar = screen.getByRole('toolbar', { name: 'Studio toolbar' });
    expect(within(toolbar).getByRole('button', { name: 'View options' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Canvas' })).queryByRole('button', { name: 'View options' })
    ).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'View options' }));
  };

  it('toggles grid, safe area and mask from View options, all real', () => {
    const project = createBlankProject('Stage', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);
    const canvas = screen.getByRole('region', { name: 'Canvas' });

    expect(canvas.querySelector('.ic-canvas-grid')).not.toBeInTheDocument();

    openViewOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Grid — Off' }));
    expect(canvas.querySelector('.ic-canvas-grid')).toBeInTheDocument();

    // The safe-area guide draws from the document's own safeArea box.
    expect(canvas.querySelector('.ic-safe-area-overlay')).not.toBeInTheDocument();
    openViewOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Safe area — Off' }));
    expect(canvas.querySelector('.ic-safe-area-overlay')).toBeInTheDocument();

    // Unmasking squares the frame; the export still masks (preview flag only).
    const frame = canvas.querySelector('.ic-canvas-frame') as HTMLElement;
    expect(frame.style.borderRadius).not.toBe('0px');
    openViewOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Icon mask — On' }));
    expect(frame.style.borderRadius).toBe('0px');
  });

  it('switches variant tiles without losing the selection', () => {
    const project = createBlankProject('Tiles', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);

    fireEvent.click(within(screen.getByRole('region', { name: 'Layers panel' })).getByText('Prism'));
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('region', { name: 'Canvas' })).toHaveTextContent('Dark');
    // Orientation kept: the same layer stays selected at the same size.
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');
  });

  it('pans with the Hand without moving layers or losing selection', () => {
    const project = createBlankProject('Pan', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);

    fireEvent.click(within(screen.getByRole('region', { name: 'Layers panel' })).getByText('Prism'));
    fireEvent.keyDown(window, { key: 'h' });

    const stage = document.querySelector('.studio-stage') as HTMLElement;
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { clientX: 150, clientY: 120 });
    fireEvent.pointerUp(stage);
    expect(stage.style.getPropertyValue('--pan-x')).toBe('50px');
    expect(stage.style.getPropertyValue('--pan-y')).toBe('20px');

    // The pan's trailing click never reaches the canvas: selection survives.
    fireEvent.click(stage);
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');
  });
});

describe('Studio inspector panel (Fase 4)', () => {
  const prism = (): IconLayer => ({
    id: 'layer-prism',
    name: 'Prism',
    kind: 'shape',
    visible: true,
    zIndex: 1,
    source: { type: 'inline', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    fill: { kind: 'solid', color: '#3f6ce0', alpha: 1 }
  });

  it('alterna Design e Preview sem perder a seleção', () => {
    const project = createBlankProject('Panel', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    fireEvent.click(within(screen.getByRole('region', { name: 'Layers panel' })).getByText('Prism'));
    // Design mostra o inspector contextual com a seção nova de Stroke.
    expect(within(inspector).getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(within(inspector).getByRole('tab', { name: 'Preview' }));
    const tiles = within(inspector).getByRole('group', { name: 'Appearance variants' });
    for (const name of ['Default', 'Light', 'Dark', 'Monochrome']) {
      expect(within(tiles).getByRole('button', { name })).toBeInTheDocument();
    }

    fireEvent.click(within(inspector).getByRole('tab', { name: 'Design' }));
    expect(within(inspector).getByDisplayValue('Prism')).toBeInTheDocument();
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');
  });

  it('o traço engrossa sem esticar a forma, no canvas', () => {
    const project = createBlankProject('Width', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });
    const canvas = screen.getByRole('region', { name: 'Canvas' });

    fireEvent.click(within(screen.getByRole('region', { name: 'Layers panel' })).getByText('Prism'));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add stroke' }));
    fireEvent.change(within(inspector).getByRole('slider', { name: 'Stroke width' }), { target: { value: '24' } });

    // A tag de dimensão do canvas não mexe: 220 × 220 antes e depois.
    expect(within(canvas).getByText('220 × 220')).toBeInTheDocument();
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');
  });
});

describe('Studio export dialog + main menu (Fase 5)', () => {
  const openMenu = (name: string) => {
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Main menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name }));
  };

  it('opens the three-stage export from the main menu, gated by validation', () => {
    renderShell(<SeededShell project={createBlankProject('Export', 512)} />);

    // Navigation runs on the URL hash: setting it only navigates when the
    // `hashchange` fires, which jsdom never does on its own (a real browser
    // does). Emit it, like the browser would.
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent(window, new Event('hashchange'));
    const dialog = screen.getByRole('dialog', { name: 'Export icons' });
    expect(within(dialog).getByText('SVG')).toBeInTheDocument();
    expect(within(dialog).getByText('PNG')).toBeInTheDocument();
    expect(within(dialog).getByText('ICO')).toBeInTheDocument();

    // Deselecting every format leaves nothing to render: no export.
    // (Re-query between clicks: each toggle re-renders the inputs.)
    const box = (name: string) => within(dialog).getByRole('checkbox', { name: name });
    const exportName = () => within(dialog).getByRole('button', { name: /Export/ }).textContent;
    fireEvent.click(box('SVG'));
    const afterSvg = exportName();
    fireEvent.click(box('PNG'));
    const afterPng = exportName();
    expect([afterSvg, afterPng]).toEqual(['Export 2 files', 'Export ']);
    expect(within(dialog).getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('renames the document through the menu form', () => {
    renderShell(<SeededShell project={createBlankProject('Old', 512)} />);
    openMenu('Rename document…');

    const field = screen.getByLabelText('Name');
    fireEvent.change(field, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getAllByText('Renamed').length).toBeGreaterThan(0);
  });

  it('asks before a new document destroys the old one', () => {
    const project = createBlankProject('Keep', 512);
    renderShell(<SeededShell project={project} />);
    openMenu('New document…');

    expect(screen.getByRole('dialog', { name: 'New document?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));

    const form = screen.getByRole('dialog', { name: 'New document' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Fresh' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create document' }));
    expect(screen.getAllByText('Fresh').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('0');
  });

  it('closes the document through the menu confirm, back to the workspace list', () => {
    const project = createBlankProject('Open', 512);
    // The provider navigates from the URL hash on mount: leaving `#/workspaces`
    // behind would open the welcome (and its banner) under the next test.
    const prevHash = window.location.hash;
    try {
      renderShell(<SeededShell project={project} />);
      openMenu('Close document');

      expect(screen.getByRole('dialog', { name: 'Close this document?' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close document' }));
      expect(screen.queryByRole('dialog', { name: 'Close this document?' })).not.toBeInTheDocument();
      // No project: the welcome owns the screen and the doc chrome reports it.
      expect(screen.getByRole('dialog', { name: 'Start a new icon' })).toBeInTheDocument();
      expect(screen.getByText('No document')).toBeInTheDocument();
    } finally {
      window.location.hash = prevHash;
    }
  });

  it('persists the theme preference from the preferences dialog', () => {
    renderShell(<SeededShell project={createBlankProject('Prefs', 512)} />);
    openMenu('Preferences…');

    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(window.localStorage.getItem('iconcore-theme-preference')).toBe('system');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Preferences' })).not.toBeInTheDocument();
  });
});

describe('StudioApp shell (Fase 1)', () => {
  it('mounts the five regions with the document chrome', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    expect(screen.getByRole('toolbar', { name: 'Studio toolbar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Layers panel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Canvas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector panel' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeInTheDocument();

    // Brand + document, not a dashboard. The name lives in two homes: the
    // titlebar breadcrumb and the panel title that renames. The canvas
    // breadcrumb is gone — its variant half moved to the titlebar too.
    expect(screen.getByText('Icon-Core')).toBeInTheDocument();
    expect(screen.getAllByText('Studio One')).toHaveLength(2);
  });

  it('keeps the document breadcrumb in the titlebar and nothing else in the canvas', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    const titlebar = screen.getByRole('banner');
    expect(within(titlebar).getByText('Studio One')).toBeInTheDocument();
    expect(within(titlebar).getByText('Default')).toBeInTheDocument();

    // The canvas carries no breadcrumb, no View options and no creation bar:
    // the Layers header Insert is the one entry point.
    const canvas = screen.getByRole('region', { name: 'Canvas' });
    expect(within(canvas).queryByRole('button', { name: 'View options' })).not.toBeInTheDocument();
    for (const name of ['Add shape', 'Add text layer', 'Add background fill layer', 'Upload image']) {
      expect(within(canvas).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Main menu' })).toBeInTheDocument();
  });

  it('runs the pill in mockup order with every tool acting', () => {
    const project = createBlankProject('Pill', 512);
    project.layers = [
      {
        id: 'layer-prism',
        name: 'Prism',
        kind: 'shape',
        visible: true,
        zIndex: 1,
        source: { type: 'inline', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#3f6ce0', alpha: 1 }
      }
    ];
    renderShell(<SeededShell project={project} />);
    const pill = screen.getByRole('toolbar', { name: 'Canvas tools' });
    const names = within(pill)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '');

    // Tools, icon styles and order follow the mockup: no keyline toggle and
    // no platform cycle here — both stay reachable from their own homes.
    expect(names).toEqual([
      'Selection tool',
      'Hand tool',
      'Toggle grid',
      'Toggle safe area',
      'Toggle snapping',
      'Zoom out',
      'Zoom 100 percent',
      'Zoom in',
      'Fit to canvas'
    ]);

    // The safe-area toggle draws the real guide on the canvas.
    const canvas = screen.getByRole('region', { name: 'Canvas' });
    expect(canvas.querySelector('.ic-safe-area-overlay')).not.toBeInTheDocument();
    fireEvent.click(within(pill).getByRole('button', { name: 'Toggle safe area' }));
    expect(canvas.querySelector('.ic-safe-area-overlay')).toBeInTheDocument();

    // The zoom menu jumps to a real preset…
    fireEvent.pointerDown(within(pill).getByRole('button', { name: 'Zoom 100 percent' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '150%' }));
    expect(within(pill).getByRole('button', { name: 'Zoom 150 percent' })).toBeInTheDocument();

    // …and Fit to canvas returns zoom (and the Hand pan) together.
    fireEvent.click(within(pill).getByRole('button', { name: 'Fit to canvas' }));
    expect(within(pill).getByRole('button', { name: 'Zoom 100 percent' })).toBeInTheDocument();
  });

  it('collapses each side panel and always offers an evident way back', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    const layers = screen.getByRole('region', { name: 'Layers panel' });
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });
    expect(layers).toHaveAttribute('data-open', 'true');
    expect(inspector).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide Layers panel' }));
    expect(layers).toHaveAttribute('data-open', 'false');
    // The reopening control is in the same toolbar, named for the panel.
    fireEvent.click(screen.getByRole('button', { name: 'Show Layers panel' }));
    expect(layers).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide Inspector panel' }));
    expect(inspector).toHaveAttribute('data-open', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Show Inspector panel' }));
    expect(inspector).toHaveAttribute('data-open', 'true');
  });

  it('resolves the theme through data-theme, dark-first', () => {
    renderShell();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps Layers, Canvas and Inspector synchronised on selection', () => {
    const project = createBlankProject('Sync', 512);
    project.layers = [
      {
        id: 'layer-prism',
        name: 'Prism',
        kind: 'shape',
        visible: true,
        zIndex: 1,
        source: { type: 'inline', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#3f6ce0', alpha: 1 }
      }
    ];
    renderShell(<SeededShell project={project} />);

    // One layer in the tree…
    const layersPanel = screen.getByRole('region', { name: 'Layers panel' });
    expect(layersPanel).toHaveTextContent('Prism');
    // …selected from the tree, reflected in the statusbar dimensions…
    fireEvent.click(within(layersPanel).getByText('Prism'));
    expect(screen.getByLabelText('Selection dimensions')).toHaveTextContent('220 × 220 px');
    // …and in the inspector, whose name field carries the active layer.
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });
    expect(within(inspector).getByDisplayValue('Prism')).toBeInTheDocument();
  });
});
