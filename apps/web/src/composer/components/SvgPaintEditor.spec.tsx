import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SvgPaintEditor } from './SvgPaintEditor';
import type { SvgPaintColor } from '@iconcore/renderer';

/**
 * `IC63/1b` — o editor de cores do SVG importado.
 *
 * O defeito que este componente substitui tinha duas metades, e a UI é metade do
 * conserto: o `Fill` aparecia para uma layer que não tem pintura nenhuma, dizia
 * "transparent" para uma camada que desenhava branco, e **mexer nele não fazia
 * nada**. Um controle que não age é pior que um controle ausente, porque a pessoa
 * acredita que configurou algo.
 *
 * O que estes testes prendem:
 *  - **uma linha por cor**, para trocar o branco sem tocar no laranja;
 *  - o botão de restaurar só existe quando há algo para restaurar;
 *  - e que a origem continua visível, porque sem ela o override é um hex solto.
 *
 * Os seletores são pelo aria-label **completo** que o `ColorField` compõe
 * (`<label> hex`, `<label> alpha percent`, `Choose <label>`) e não por prefixo: a
 * primeira versão usou o prefixo e o `getByLabelText` reclamou de quatro elementos.
 */
const CORES: SvgPaintColor[] = [
  { hex: '#ffffff', count: 3, roles: ['fill'], literal: '#ffffff' },
  { hex: '#ff8800', count: 1, roles: ['fill'], literal: '#ff8800' }
];

/**
 * O campo hex de uma linha.
 *
 * `getAllByLabelText` e não `getByLabelText`: o `ColorField` renderiza um `<label>`
 * **e** um `<input aria-label>` com o mesmo texto, e `getByLabelText` devolve os dois.
 * Filtrar pelo elemento é explícito sobre o que se quer — o input, não o rótulo.
 */
const campoHex = (origem: string, contagem: number): HTMLInputElement => {
  const candidatos = screen.getAllByLabelText(
    new RegExp(`^Replace ${origem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, used ${contagem} times hex$`, 'i')
  );
  const input = candidatos.find((el): el is HTMLInputElement => el instanceof HTMLInputElement);
  if (!input) throw new Error(`nenhum <input> para ${origem} (${contagem}x)`);
  return input;
};

const botaoRestaurar = (origem: string) => screen.getByRole('button', { name: `Restore ${origem}` });

const montar = (
  overrides?: Record<string, string>,
  onChange: (next: Record<string, string>, transient?: boolean) => void = () => {}
) => render(<SvgPaintEditor colors={CORES} overrides={overrides} onChange={onChange} onCommit={() => {}} />);

/**
 * `cleanup` explícito, e não `globals: true`.
 *
 * A configuração do Vitest deste projeto **não** tem auto-cleanup, e sem ele o DOM
 * acumula entre os testes: o `getAllByLabelText` da linha 2 acha o input do render da
 * linha 1, e o teste passa ou falha por causa de outro teste. Foi o que aconteceu aqui
 * — "expected 'FFFFFF' to contain '101010'" num caso em que o componente estava
 * certo. A mesma convenção já é usada em `UiGallery.spec.tsx` e `useFocusTrap.spec.tsx`.
 */
afterEach(cleanup);

describe('SvgPaintEditor', () => {
  it('nao renderiza nada quando o arquivo nao tem cor', () => {
    const { container } = render(
      <SvgPaintEditor colors={[]} overrides={undefined} onChange={() => {}} onCommit={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra UMA linha por cor do arquivo', () => {
    montar();
    // Duas linhas, e nao um controle com duas cores: trocar o branco de um icone
    // bicolor nao pode levar o laranja junto.
    expect(campoHex('#ffffff', 3)).toBeInTheDocument();
    expect(campoHex('#ff8800', 1)).toBeInTheDocument();
  });

  it('conta as ocorrencias, porque 3 usos e 1 uso sao escolhas diferentes', () => {
    // A cor que o arquivo usa em 3 lugares e a que usa em 1: a pessoa precisa saber qual
    // esta trocando antes de trocar.
    montar();
    expect(screen.getByTitle('Original #ffffff · 3×')).toBeInTheDocument();
    expect(screen.getByTitle('Original #ff8800 · 1×')).toBeInTheDocument();
  });

  it('comeca com o valor original quando nao ha override', () => {
    montar();
    expect(campoHex('#ffffff', 3).value.toUpperCase()).toContain('FFFFFF');
    expect(campoHex('#ff8800', 1).value.toUpperCase()).toContain('FF8800');
  });

  it('mostra o valor substituido quando ha override, e nao o original', () => {
    montar({ '#ffffff': '#101010' });
    expect(campoHex('#ffffff', 3).value.toUpperCase()).toContain('101010');
  });

  it('mantem a origem visivel mesmo com override', () => {
    // Sem a referencia do que esta sendo trocado, o override vira um hex solto e a
    // pessoa nao sabe o que restaurou depois.
    montar({ '#ffffff': '#101010' });
    expect(screen.getByTitle('Original #ffffff · 3×')).toBeInTheDocument();
  });

  it('so habilita restaurar onde ha algo para restaurar', () => {
    montar({ '#ffffff': '#101010' });
    // O laranja nao foi trocado: botao desabilitado, e nao um botao que nao faz nada.
    expect(botaoRestaurar('#ffffff')).toBeEnabled();
    expect(botaoRestaurar('#ff8800')).toBeDisabled();
  });

  it('devolve o mapa sem a cor restaurada, preservando as outras', async () => {
    const usuario = userEvent.setup();
    let recebido: Record<string, string> | undefined;
    montar({ '#ffffff': '#101010', '#ff8800': '#00ff00' }, (proximo) => {
      recebido = proximo;
    });

    await usuario.click(botaoRestaurar('#ffffff'));

    expect(recebido).toEqual({ '#ff8800': '#00ff00' });
  });

  it('nao mostra picker para token que o ColorField nao sabe ler', () => {
    // `currentcolor` resolveria para preto no `normalizeHex` do kit — e preto e uma
    // mentira. A linha mostra o literal, sem campo.
    const comToken: SvgPaintColor[] = [
      { hex: 'currentcolor', count: 2, roles: ['fill'], literal: 'currentColor' }
    ];
    render(<SvgPaintEditor colors={comToken} overrides={undefined} onChange={() => {}} onCommit={() => {}} />);

    expect(screen.getByText('currentcolor')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Replace currentcolor/)).not.toBeInTheDocument();
  });
});