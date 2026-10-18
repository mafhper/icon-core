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
 * Export é a grade 2×2 dos mesmos tiles vivos do canvas, e o pé de sessão
 * existe. Nenhum teste afirma cor — cor se mede no guard, não no spec.
 */
describe('Studio FATIA 1b (mockup visual port)', () => {
  it('a variante vive só nos tiles: sem duplicata na barra, View options no gatilho do mockup', () => {
    renderShell(<SeededShell project={createBlankProject('Triggers', 512)} />);

    expect(screen.getByRole('button', { name: 'View options' })).toHaveClass('studio-trigger');
    // A variante não tem gatilho na barra do canvas: os tiles a dirigem sozinhos.
    expect(screen.queryByRole('button', { name: /^Appearance: / })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Appearance variants' })).toBeInTheDocument();
  });

  it('a aba Export é a grade 2×2 dos tiles vivos do canvas', () => {
    renderShell(<SeededShell project={createBlankProject('Preview', 512)} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    fireEvent.click(within(inspector).getByRole('tab', { name: 'Export' }));
    const grid = within(inspector).getByRole('group', { name: 'Variants' });
    expect(grid).toHaveClass('studio-tiles-grid');
    for (const name of ['Default', 'Light', 'Dark', 'Monochrome']) {
      expect(within(grid).getByRole('checkbox', { name })).toBeInTheDocument();
    }
  });

  it('o inspetor carrega o pé de sessão do mockup', () => {
    renderShell(<SeededShell project={createBlankProject('Foot', 512)} />);
    const inspector = screen.getByRole('region', { name: 'Inspector panel' });

    expect(within(inspector).getByText('All changes in this session')).toBeInTheDocument();
  });

  it('a mesa segue a coluna do mockup: barra, legenda, faixa, toolbar', () => {
    renderShell(<SeededShell project={createBlankProject('Ordem', 1024)} />);
    const canvas = screen.getByRole('region', { name: 'Canvas' });

    // A legenda lê perfil, tamanho e variante, nessa ordem.
    expect(within(canvas).getByText('sRGB')).toBeInTheDocument();
    expect(within(canvas).getByText('1024 × 1024 px')).toBeInTheDocument();
    expect(within(canvas).getByText('Default appearance')).toBeInTheDocument();

    // A ordem é a do mockup: barra da coluna, palco, faixa das variantes
    // (a seção que carrega a legenda e os tiles) e toolbar — sem flutuação.
    const ordem = Array.from(canvas.children).map((el) => el.getAttribute('class'));
    expect(ordem).toEqual(['studio-canvasbar', 'studio-stage-wrap', 'studio-variant-band', 'studio-pillbar']);
    const faixa = canvas.querySelector('.studio-variant-band') as HTMLElement;
    expect(Array.from(faixa.children).map((el) => el.getAttribute('class'))).toEqual([
      'studio-caption',
      'studio-tiles'
    ]);
  });

  it('a mesa padrão é o workspace: palco e faixa no mesmo pano, sem banda', () => {
    // Sem cor escolhida, os inlines da mesa (palco, superfície de edição e a
    // faixa das variantes) caem na mesa do mockup — não no fundo do app, que
    // era o que pintava o palco de um fundo e a faixa de outro. Cor se mede no
    // guard; aqui fica o papel que pinta: o token da mesa, não um valor
    // resolvido.
    renderShell(<SeededShell project={createBlankProject('Mesa', 512)} />);
    const stage = document.querySelector('.studio-stage') as HTMLElement | null;
    const edit = document.querySelector('.studio-stage .ic-edit-stage') as HTMLElement | null;
    const faixa = document.querySelector('.studio-variant-band') as HTMLElement | null;
    expect(stage?.style.backgroundColor).toContain('--ic-workspace');
    expect(edit?.style.backgroundColor).toContain('--ic-workspace');
    expect(faixa?.style.backgroundColor).toContain('--ic-workspace');
  });
});
