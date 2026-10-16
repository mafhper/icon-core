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

describe('StudioApp shell (Fase 1)', () => {
  it('mounts the five regions with the document chrome', () => {
    renderShell(<SeededShell project={createBlankProject('Studio One', 1024)} />);

    expect(screen.getByRole('toolbar', { name: 'Studio toolbar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Layers panel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Canvas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector panel' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeInTheDocument();

    // Brand + document, not a dashboard.
    expect(screen.getByText('Icon-Core')).toBeInTheDocument();
    expect(screen.getByText('Studio One')).toBeInTheDocument();
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
