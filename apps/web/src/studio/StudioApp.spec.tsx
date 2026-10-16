import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
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

describe('StudioApp shell (Fase 1)', () => {
  it('mounts the five regions with the document chrome', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    expect(screen.getByRole('toolbar', { name: 'Studio toolbar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Layers panel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Canvas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector panel' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeInTheDocument();

    // Brand + document, not a dashboard. The name lives in two homes on
    // purpose (mockup): the titlebar readout and the panel title that renames.
    expect(screen.getByText('Icon-Core')).toBeInTheDocument();
    expect(screen.getAllByText('Studio One')).toHaveLength(2);
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
