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

const SeededShell = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioShell />;
};

/**
 * FATIA 1b — porte visual do mockup (estrutura, sem comportamento).
 *
 * O visual (tokens, métricas, Manrope) mora em `studio.css` + `tokens.css` e é
 * medido pelos portões (contraste com o mapa escopado, terceiros, marca); aqui
 * fica a amarração estrutural: os gatilhos falam a classe do mockup, a aba
 * Preview é a grade 2×2 dos mesmos tiles vivos do canvas, e o pé de sessão
 * existe. Nenhum teste afirma cor — cor se mede no guard, não no spec.
 */
describe('Studio FATIA 1b (mockup visual port)', () => {
  it('usa o gatilho do mockup (29px) em Appearance e View options', () => {
    renderShell(<SeededShell project={createBlankProject('Triggers', 512)} />);

    expect(screen.getByRole('button', { name: 'Appearance: Default' })).toHaveClass('studio-trigger');
    expect(screen.getByRole('button', { name: 'View options' })).toHaveClass('studio-trigger');
  });

  it('a aba Preview é a grade 2×2 dos tiles vivos do canvas', () => {
    renderShell(<SeededShell project={createBlankProject('Preview', 512)} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    fireEvent.click(within(inspector).getByRole('tab', { name: 'Preview' }));
    const grid = within(inspector).getByRole('group', { name: 'Appearance variants' });
    expect(grid).toHaveClass('studio-tiles-grid');
    for (const name of ['Default', 'Light', 'Dark', 'Monochrome']) {
      expect(within(grid).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('o inspetor carrega o pé de sessão do mockup', () => {
    renderShell(<SeededShell project={createBlankProject('Foot', 512)} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    expect(within(inspector).getByText('All changes in this session')).toBeInTheDocument();
  });
});
