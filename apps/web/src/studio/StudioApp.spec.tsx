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
  it('inserts an ellipse through the Layers header Insert menu', () => {
    renderShell(<SeededShell project={createBlankProject('Insert', 512)} />);
    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('0');

    // Insert lives only in the Layers header (the canvas bar carries no
    // creation control). Radix opens dropdowns on pointer-down, not on click.
    const layers = screen.getByRole('region', { name: 'Layers panel' });
    fireEvent.pointerDown(within(layers).getByRole('button', { name: 'Insert layer' }));
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
    // View options lives in the canvas bar, over the canvas column — not in
    // the titlebar, and the canvas carries no other copy.
    const canvas = screen.getByRole('region', { name: 'Canvas' });
    expect(within(canvas).getByRole('button', { name: 'View options' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'View options' })
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

  it('o frame segue a forma declarada no documento, não o default da barra', () => {
    const project = createBlankProject('Forma', 512);
    project.canvas.maskShape = 'circle';
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);

    const canvas = screen.getByRole('region', { name: 'Canvas' });
    const frame = canvas.querySelector('.ic-canvas-frame') as HTMLElement;
    // O documento declara `circle` e não fixa raio: o raio é o default da
    // forma (512 / 2), não os 24px do rounded-rectangle do estado da barra.
    // Mesmo resolver do export (`resolveMaskRadius`), para frame e arquivo
    // não divergirem quando um projeto carregado declara outra forma.
    expect(frame.style.borderRadius).toBe('256px');
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

  it('alterna Design e Export sem perder a seleção', () => {
    const project = createBlankProject('Panel', 512);
    project.layers = [prism()];
    renderShell(<SeededShell project={project} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    fireEvent.click(within(screen.getByRole('region', { name: 'Layers panel' })).getByText('Prism'));
    // Design mostra o inspector contextual com a seção nova de Stroke.
    expect(within(inspector).getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(within(inspector).getByRole('tab', { name: 'Export' }));
    const tiles = within(inspector).getByRole('group', { name: 'Variants' });
    for (const name of ['Default', 'Light', 'Dark', 'Monochrome']) {
      expect(within(tiles).getByRole('checkbox', { name })).toBeInTheDocument();
    }
    // The export action lives at the end of the tab — not in the titlebar,
    // not in the canvas bar.
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('toolbar', { name: 'Studio toolbar' })).queryByRole('button', { name: 'Export' })
    ).not.toBeInTheDocument();

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

describe('Studio export in the Inspector + distributed titlebar (Fase 5)', () => {
  // The actions are bar buttons now, not rows in a main menu: the document and
  // the way out live in the titlebar itself.
  const clickBarAction = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  it('opens the three-stage export from the Export tab, gated by validation', () => {
    renderShell(<SeededShell project={createBlankProject('Export', 512)} />);

    // The export stages live in the Inspector Export tab itself: open the tab
    // and the panel is the surface — no dialog, no navigation. Since the P2
    // cut this is the only export surface there is.
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Export' }));
    expect(within(inspector).getByText('SVG')).toBeInTheDocument();
    expect(within(inspector).getByText('PNG')).toBeInTheDocument();
    expect(within(inspector).getByText('ICO')).toBeInTheDocument();

    // Deselecting every format leaves nothing to render: no export.
    // (Re-query between clicks: each toggle re-renders the inputs.)
    const box = (name: string) => within(inspector).getByRole('checkbox', { name: name });
    const exportButton = () => within(inspector).getByRole('button', { name: /^Export/ });
    fireEvent.click(box('SVG'));
    expect(exportButton().textContent).toBe('Export 2 files');
    fireEvent.click(box('PNG'));
    expect(exportButton().textContent?.trim()).toBe('Export');
    expect(exportButton()).toBeDisabled();
  });

  it('as entradas de export focam a aba Export — atalho, menu e paleta — sem diálogo', () => {
    // O provider lê o hash no mount: com `#` vazio ele normaliza para
    // `workspaces` e o welcome (aria-modal) monta sobre o shell — barrando os
    // atalhos, que respeitam modal aberto. `#/edit-space` é o estado real de um
    // documento aberto no studio, que é onde as entradas de export vivem.
    const prevHash = window.location.hash;
    window.location.hash = '#/edit-space';
    try {
      renderShell(<SeededShell project={createBlankProject('Entries', 512)} />);
      const inspector = screen.getByRole('region', { name: 'Inspector panel' });
      const exportTab = () => within(inspector).getByRole('tab', { name: 'Export' });
      const designTab = () => within(inspector).getByRole('tab', { name: 'Design' });

      // Ctrl+E primeiro, de propósito: o atalho respeita menu aberto (guard
      // real), e aqui não há menu nenhum para o guard encontrar. A superfície é
      // só a aba — nunca um diálogo paralelo.
      fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
      expect(exportTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('dialog', { name: 'Export icons' })).not.toBeInTheDocument();

      // O botão Export do titlebar leva à mesma aba.
      fireEvent.click(designTab());
      clickBarAction('Export icons');
      expect(exportTab()).toHaveAttribute('aria-selected', 'true');

      // A paleta converte o comando na mesma aba.
      fireEvent.click(designTab());
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const palette = screen.getByRole('dialog', { name: 'Command palette' });
      fireEvent.click(within(palette).getByRole('button', { name: /Export icons/ }));
      expect(exportTab()).toHaveAttribute('aria-selected', 'true');
    } finally {
      window.location.hash = prevHash;
    }
  });

  it('o deep-link legado #/export-utilities cai no studio com a aba Export focada', () => {
    const prevHash = window.location.hash;
    try {
      window.location.hash = '#/export-utilities';
      renderShell(<SeededShell project={createBlankProject('Deep', 512)} />);

      // Sem welcome: a rota antiga abre o studio, não a lista de projetos.
      expect(screen.queryByRole('dialog', { name: 'Start a new icon' })).not.toBeInTheDocument();
      const inspector = screen.getByRole('region', { name: 'Inspector panel' });
      expect(within(inspector).getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
      // O hash velho é canonicalizado para a rota que o app realmente tem.
      expect(window.location.hash).toBe('#/edit-space');
    } finally {
      window.location.hash = prevHash;
    }
  });

  it('renames the document through the menu form', () => {
    renderShell(<SeededShell project={createBlankProject('Old', 512)} />);
    clickBarAction('Rename document');

    const field = screen.getByLabelText('Name');
    fireEvent.change(field, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getAllByText('Renamed').length).toBeGreaterThan(0);
  });

  it('asks before a new document destroys the old one', () => {
    const project = createBlankProject('Keep', 512);
    renderShell(<SeededShell project={project} />);
    clickBarAction('New document');

    expect(screen.getByRole('dialog', { name: 'New document?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));

    const form = screen.getByRole('dialog', { name: 'New document' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Fresh' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create document' }));
    expect(screen.getAllByText('Fresh').length).toBeGreaterThan(0);
    // "1": arquivo novo nasce com o handle de Background, sem conteudo.
    expect(screen.getByRole('region', { name: 'Layers panel' })).toHaveTextContent('1');
  });

  it('closes the document through the bar confirm, back to the workspace list', () => {
    const project = createBlankProject('Open', 512);
    // The provider navigates from the URL hash on mount: leaving `#/workspaces`
    // behind would open the welcome (and its banner) under the next test.
    const prevHash = window.location.hash;
    try {
      renderShell(<SeededShell project={project} />);
      clickBarAction('Close document');

      const confirm = screen.getByRole('dialog', { name: 'Close this document?' });
      // The bar button carries the same name: the confirm is scoped to its own
      // dialog, which is also how a person reads it.
      fireEvent.click(within(confirm).getByRole('button', { name: 'Close document' }));
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
    clickBarAction('Preferences');

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

  it('keeps the document breadcrumb in the titlebar and the column bar over the canvas', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    const titlebar = screen.getByRole('banner');
    expect(within(titlebar).getByText('Studio One')).toBeInTheDocument();
    expect(within(titlebar).getByText('Default')).toBeInTheDocument();

    // Distributed titlebar: the document, the way out and the system share the
    // bar, each in its own named group.
    const document = within(titlebar).getByRole('group', { name: 'Document' });
    expect(within(document).getByRole('button', { name: 'New document' })).toBeEnabled();
    expect(within(document).getByRole('button', { name: 'Rename document' })).toBeEnabled();
    expect(within(document).getByRole('button', { name: 'Close document' })).toBeEnabled();
    const output = within(titlebar).getByRole('group', { name: 'Output' });
    expect(within(output).getByRole('button', { name: 'Save session' })).toBeEnabled();
    expect(within(output).getByRole('button', { name: 'Export icons' })).toBeEnabled();
    const system = within(titlebar).getByRole('group', { name: 'System' });
    expect(within(system).getByRole('button', { name: /^Theme: / })).toBeInTheDocument();
    expect(within(system).getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    // Nothing folded at this width: the overflow trigger is not rendered.
    expect(within(titlebar).queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    // The panel toggles and View options stay out of the titlebar.
    expect(within(titlebar).queryByRole('button', { name: /panel/i })).not.toBeInTheDocument();
    expect(within(titlebar).queryByRole('button', { name: 'Insert layer' })).not.toBeInTheDocument();
    expect(within(titlebar).queryByRole('button', { name: 'View options' })).not.toBeInTheDocument();

    // The canvas bar scopes undo/redo + View options to the canvas column,
    // with a panel collapse at each edge — and no Insert, no Export.
    const canvas = screen.getByRole('region', { name: 'Canvas' });
    const bar = within(canvas).getByRole('toolbar', { name: 'Studio toolbar' });
    const names = within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '');
    expect(names).toEqual([
      'Hide Layers panel',
      'Undo',
      'Redo',
      'View options',
      'Hide Inspector panel'
    ]);
    expect(within(bar).queryByRole('button', { name: 'Insert layer' })).not.toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Export icons' })).not.toBeInTheDocument();

    // The canvas carries no creation bar: the Layers header Insert is the
    // one entry point.
    for (const name of ['Add shape', 'Add text layer', 'Add background fill layer', 'Upload image']) {
      expect(within(canvas).queryByRole('button', { name })).not.toBeInTheDocument();
    }
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
