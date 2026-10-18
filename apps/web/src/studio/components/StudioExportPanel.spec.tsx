import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import type { PlanExecutionResult } from '@iconcore/exporters';
import { executePlan } from '@iconcore/exporters';
import { TooltipProvider } from '@iconcore/ui';
import { ComposerProvider, useComposer } from '../../composer/ComposerContext';
import { ToastProvider } from '../../composer/toast/ToastContext';
import { createBlankProject } from '../../composer/utils/projectFactory';
import { StudioShell } from '../StudioApp';

/**
 * O export mora na aba do Inspector agora: os estágios configure → progress →
 * done/error e o rodapé morfante. O pipeline de verdade tem provas de ficheiro
 * em e2e (assinaturas, fundo, zip); aqui trava o **estado da superfície** — o
 * plan é real (validação incluída) e só `executePlan` é substituído, para o
 * teste ser determinístico sobre a máquina de estágios.
 */
vi.mock('@iconcore/exporters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@iconcore/exporters')>()),
  executePlan: vi.fn()
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(executePlan).mockReset();
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

const SeededShell = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioShell />;
};

/** Abre a aba Export e devolve a região do Inspector — o escopo de tudo aqui. */
const openExport = () => {
  render(
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ComposerProvider>
          <SeededShell project={createBlankProject('Export', 512)} />
        </ComposerProvider>
      </ToastProvider>
    </TooltipProvider>
  );
  const inspector = screen.getByRole('region', { name: 'Inspector panel' });
  fireEvent.click(within(inspector).getByRole('tab', { name: 'Export' }));
  return inspector;
};

const arquivo = (path: string, size: number): PlanExecutionResult['files'][number] => ({
  path,
  blob: new Blob([path]),
  size,
  mime: 'image/png',
  kind: 'artifact',
  artifactId: 'studio-png-512'
});

describe('Studio export panel — S1 (configure)', () => {
  it('os tiles são cartões-checkbox multi com o anel de ativa separado', () => {
    const inspector = openExport();
    const tiles = within(inspector).getByRole('group', { name: 'Variants' });

    for (const name of ['Default', 'Light', 'Dark', 'Monochrome']) {
      expect(within(tiles).getByRole('checkbox', { name })).toBeInTheDocument();
    }
    // O default exporta só a variante ativa; o cartão dela é o único marcado.
    expect(within(tiles).getByRole('checkbox', { name: 'Default' })).toHaveAttribute('aria-checked', 'true');
    expect(within(tiles).getByRole('checkbox', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');

    // O anel é um controle separado: não marca/desmarca o cartão, troca a
    // variante ativa (SET_ACTIVE_VARIANT).
    expect(within(tiles).getByRole('button', { name: 'Set Default active' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(tiles).getByRole('button', { name: 'Set Light active' }));
    expect(within(tiles).getByRole('button', { name: 'Set Light active' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(tiles).getByRole('button', { name: 'Set Default active' })).toHaveAttribute('aria-pressed', 'false');
    // O anel não tocou a seleção do export: o cartão Default segue marcado.
    expect(within(tiles).getByRole('checkbox', { name: 'Default' })).toHaveAttribute('aria-checked', 'true');
    expect(within(tiles).getByRole('checkbox', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
  });

  it('a contagem é N artefatos × M variantes, e desmarcar o último é no-op', () => {
    const inspector = openExport();
    const tiles = within(inspector).getByRole('group', { name: 'Variants' });

    expect(within(inspector).getByText('3 files · 1 variant')).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();

    fireEvent.click(within(tiles).getByRole('checkbox', { name: 'Light' }));
    expect(within(inspector).getByText('6 files · 2 variants')).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: 'Export 6 files' })).toBeInTheDocument();

    fireEvent.click(within(tiles).getByRole('checkbox', { name: 'Light' }));
    expect(within(inspector).getByText('3 files · 1 variant')).toBeInTheDocument();

    // Mínimo 1: desmarcar o único marcado não faz nada.
    fireEvent.click(within(tiles).getByRole('checkbox', { name: 'Default' }));
    expect(within(tiles).getByRole('checkbox', { name: 'Default' })).toHaveAttribute('aria-checked', 'true');
    expect(within(inspector).getByText('3 files · 1 variant')).toBeInTheDocument();
  });

  it('o plano leva a moldura resolvida nos artefatos svg/png — o ICO fica de fora (container vence)', () => {
    vi.mocked(executePlan).mockImplementationOnce(() => new Promise<never>(() => {}));
    const inspector = openExport();
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'ICO' }));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 4 files' }));

    const [plan] = vi.mocked(executePlan).mock.calls[0] ?? [];
    const porId = new Map(plan!.artifacts.map((a) => [a.id, a]));
    // Default do editor (documento sem shape nem radius): a moldura que as tiles
    // mostram — rounded-rectangle — é a que o arquivo carrega.
    expect(porId.get('studio-svg')?.maskShape).toBe('rounded-rectangle');
    expect(porId.get('studio-png-256')?.maskShape).toBe('rounded-rectangle');
    expect(porId.get('studio-png-512')?.maskShape).toBe('rounded-rectangle');
    // Container: Windows/macOS aplicam a máscara na exibição; o artefato não
    // carrega forma (e `maskModeFor` responderia 'none' se carregasse).
    expect(porId.get('studio-ico')?.maskShape).toBeUndefined();
  });

  it('o switch de transparência desligado entrega background "opaque" a svg/png/ico', () => {
    vi.mocked(executePlan).mockImplementationOnce(() => new Promise<never>(() => {}));
    const inspector = openExport();
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'ICO' }));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 4 files' }));

    const [plan] = vi.mocked(executePlan).mock.calls[0] ?? [];
    const porId = new Map(plan!.artifacts.map((a) => [a.id, a]));
    // WYSIWYG: com o switch desligado o arquivo carrega o fundo da variante —
    // o mesmo contrato nos três formatos (o defeito era o SVG sair de fora).
    for (const id of ['studio-svg', 'studio-png-256', 'studio-png-512', 'studio-ico']) {
      expect(porId.get(id)?.background, id).toBe('opaque');
    }
  });

  it('com o switch ligado, nenhum artefato carrega background (alpha)', () => {
    vi.mocked(executePlan).mockImplementationOnce(() => new Promise<never>(() => {}));
    const inspector = openExport();
    fireEvent.click(within(inspector).getByRole('switch', { name: 'Transparent background' }));
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'ICO' }));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 4 files' }));

    const [plan] = vi.mocked(executePlan).mock.calls[0] ?? [];
    for (const artifact of plan!.artifacts) {
      expect(artifact.background, artifact.id).toBeUndefined();
    }
  });

  it('S1 não oferece Cancel: o rodapé tem só o Export N files', () => {
    const inspector = openExport();

    // Decisão do dono: o ghost em S1 só resetava defaults e não fechava nada.
    // O reset mora no Close (S3) — coberto no describe de S2/S3/S-err.
    expect(within(inspector).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
  });
});

describe('Studio export panel — S2/S3/S-err', () => {
  it('Export entra em S2 com os tiles inertes, progressbar e rodapé Exporting…', () => {
    vi.mocked(executePlan).mockImplementationOnce(() => new Promise<never>(() => {}));
    const inspector = openExport();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 3 files' }));

    expect(within(inspector).getByText(/Rendering 3 files/)).toBeInTheDocument();
    expect(within(inspector).getByRole('progressbar', { name: 'Export progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(within(inspector).getByRole('button', { name: 'Exporting…' })).toBeDisabled();
    expect(within(inspector).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // Tiles inertes: os mesmos cartões, desabilitados (re-query: a grade de S1
    // desmontou).
    const inertTiles = within(inspector).getByRole('group', { name: 'Variants' });
    expect(within(inertTiles).getByRole('checkbox', { name: 'Default' })).toBeDisabled();
    expect(within(inertTiles).getByRole('button', { name: 'Set Light active' })).toBeDisabled();
  });

  it('Cancel aborta de forma cooperativa: a flag derruba o próximo tick do pipeline', () => {
    vi.mocked(executePlan).mockImplementationOnce(() => new Promise<never>(() => {}));
    const inspector = openExport();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 3 files' }));
    const onProgress = vi.mocked(executePlan).mock.calls[0]?.[3]?.onProgress;
    expect(onProgress).toBeTypeOf('function');

    fireEvent.click(within(inspector).getByRole('button', { name: 'Cancel' }));
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
    expect(within(inspector).queryByRole('progressbar')).not.toBeInTheDocument();

    // Com a flag ligada, o tick seguinte lança — é o que faz o executePlan
    // real desenrolar o laço entre encodes (sem AbortSignal, sem API nova).
    expect(() => onProgress!({ phase: 'encoding', completed: 0, total: 3, done: false })).toThrow();
  });

  it('resultado tardio de uma corrida cancelada não vaza para a UI', async () => {
    let liberar!: () => void;
    const gate = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    vi.mocked(executePlan).mockImplementationOnce(async () => {
      await gate;
      return { files: [arquivo('Icon-default.svg', 512)], warnings: [], planned: [] };
    });
    const inspector = openExport();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 3 files' }));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      liberar();
      await gate;
    });

    // S1 segue no lugar: nada de "ready", lista ou alerta do resultado antigo.
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
    expect(within(inspector).queryByText(/ready\./)).not.toBeInTheDocument();
    expect(within(inspector).queryByRole('alert')).not.toBeInTheDocument();
    expect(inspector.querySelectorAll('.studio-export-files li')).toHaveLength(0);
  });

  it('done lista nome+tamanho+Download e o rodapé oferece zip, Export more e Close', async () => {
    vi.mocked(executePlan).mockResolvedValueOnce({
      files: [arquivo('Icon-default.svg', 512), arquivo('Icon-default-256px.png', 2048), arquivo('Icon-default-512px.png', 8192)],
      warnings: [],
      planned: []
    });
    const inspector = openExport();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 3 files' }));

    expect(await within(inspector).findByText(/3 files ready\./)).toBeInTheDocument();
    const linhas = inspector.querySelectorAll('.studio-export-files li');
    expect(linhas).toHaveLength(3);
    expect(within(inspector).getByText('Icon-default.svg')).toBeInTheDocument();
    expect(within(inspector).getByText('2.0 KB')).toBeInTheDocument();
    expect(within(inspector).getAllByRole('button', { name: 'Download' })).toHaveLength(3);
    expect(within(inspector).getByRole('button', { name: 'Download all (.zip)' })).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    // Export more volta a S1 **preservando** a seleção.
    fireEvent.click(within(inspector).getByRole('button', { name: 'Export more' }));
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
    expect(within(inspector).getByText('3 files · 1 variant')).toBeInTheDocument();
  });

  it('Close (S3) reseta os defaults: formatos, tamanhos, variantes e transparência', async () => {
    vi.mocked(executePlan).mockResolvedValueOnce({
      files: [arquivo('Icon-dark.svg', 512)],
      warnings: [],
      planned: []
    });
    const inspector = openExport();
    const tiles = within(inspector).getByRole('group', { name: 'Variants' });

    fireEvent.click(within(tiles).getByRole('checkbox', { name: 'Light' }));
    fireEvent.click(within(tiles).getByRole('button', { name: 'Set Dark active' }));
    fireEvent.click(within(inspector).getByRole('checkbox', { name: '1024' }));
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'PNG' }));
    fireEvent.click(within(inspector).getByRole('switch', { name: 'Transparent background' }));

    // PNG fora ⇒ 1 artefato × 2 variantes.
    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 2 files' }));
    expect(await within(inspector).findByText(/1 file ready\./)).toBeInTheDocument();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Close' }));

    // Re-query: a grade de S2/S3 desmontou; S1 volta com defaults frescos.
    const tilesReset = within(inspector).getByRole('group', { name: 'Variants' });
    expect(within(inspector).getByRole('checkbox', { name: 'PNG' })).toBeChecked();
    expect(within(inspector).getByRole('checkbox', { name: '1024' })).not.toBeChecked();
    expect(within(inspector).getByRole('switch', { name: 'Transparent background' })).not.toBeChecked();
    // Variantes: o reset volta à ativa — que o anel acabou de mudar para dark.
    expect(within(tilesReset).getByRole('checkbox', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(within(tilesReset).getByRole('checkbox', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
    expect(within(inspector).getByText('3 files · 1 variant')).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
  });

  it('erro do pipeline vira S-err com role=alert, e Back volta a S1', async () => {
    vi.mocked(executePlan).mockRejectedValueOnce(new Error('Encoder exploded'));
    const inspector = openExport();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Export 3 files' }));

    const alerta = await within(inspector).findByRole('alert');
    expect(alerta).toHaveTextContent('Encoder exploded');
    fireEvent.click(within(inspector).getByRole('button', { name: 'Back' }));
    expect(within(inspector).getByRole('button', { name: 'Export 3 files' })).toBeInTheDocument();
  });
});
