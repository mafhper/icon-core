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
 * `O picker` — a linha passou a usar o `StudioColorPicker`, o mesmo do `Fill`
 * comum (chevron expande inline, swatch abre o painel). O `ColorField` do kit
 * sai do Fill de SVG, e Library/Recent **não** vêm junto: por decisão, eles
 * ficam só no `ColorField` legado. Os testes abaixo travam as duas metades —
 * o picker novo montado por linha e o `HexColorPicker` (`react-colorful`) do
 * `ColorField` ausente, inclusive com o corpo expandido.
 *
 * Os seletores são pelo aria-label **completo** que o picker compõe
 * (`<label> hex`, `<label> alpha percent`, `Choose <label> color`) e não por
 * prefixo: a primeira versão usou o prefixo e o `getByLabelText` reclamou de
 * quatro elementos.
 */
const CORES: SvgPaintColor[] = [
  { hex: '#ffffff', count: 3, roles: ['fill'], literal: '#ffffff' },
  { hex: '#ff8800', count: 1, roles: ['fill'], literal: '#ff8800' }
];

/**
 * O campo hex de uma linha.
 *
 * Os rótulos são os que o `StudioColorPicker` compõe: `Choose <label> color` no
 * swatch, `<label> hex` no campo hex, `<label> alpha percent` no alpha e
 * `Expand|Collapse <label> picker` no chevron. O `ColorField` do kit saiu do Fill
 * de SVG — com ele foi o par `<label>` + `<input aria-label>` com o mesmo texto
 * que obrigava a filtrar por elemento. O `$` do regex separa o campo do cabeçalho
 * (`<label> hex`) do campo do corpo expandido (`<label> hex value`), e o filtro
 * por `<input>` mantém o helper apontado para o campo.
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

/** O chevron do `StudioColorPicker` da linha: `Expand|Collapse <label> picker`. */
const botaoChevron = (origem: string, contagem: number, aberto = false) =>
  screen.getByRole('button', {
    name: `${aberto ? 'Collapse' : 'Expand'} Replace ${origem}, used ${contagem} times picker`
  });

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

  it('monta o StudioColorPicker em cada linha, e nao o ColorField do kit', () => {
    const { container } = montar();

    // O contrato do picker novo: chevron por linha + swatch "Choose ... color".
    expect(botaoChevron('#ffffff', 3)).toBeInTheDocument();
    expect(botaoChevron('#ff8800', 1)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Choose Replace #ffffff, used 3 times color' })
    ).toBeInTheDocument();

    // O `ColorField` do kit monta `HexColorPicker`/`react-colorful`; o studio nao.
    expect(container.querySelector('.react-colorful')).toBeNull();
  });

  it('expande o corpo do picker dentro da propria linha', async () => {
    const usuario = userEvent.setup();
    const { container } = montar();

    await usuario.click(botaoChevron('#ffffff', 3));

    // A area de saturacao/brilho e do `StudioColorPicker`, e so dele.
    expect(
      screen.getByRole('group', {
        name: 'Replace #ffffff, used 3 times saturation and brightness. Arrow keys adjust.'
      })
    ).toBeInTheDocument();
    // Mesmo aberto, nenhum `HexColorPicker` na arvore: nao ha `ColorField` na linha.
    expect(container.querySelector('.react-colorful')).toBeNull();
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

  it('grava o override na cor de origem quando o hex muda, como transiente', async () => {
    const usuario = userEvent.setup();
    const chamadas: Array<{ valor: Record<string, string>; transient: boolean | undefined }> = [];
    montar({ '#ff8800': '#00ff00' }, (proximo, transient) => {
      chamadas.push({ valor: proximo, transient });
    });

    const entrada = campoHex('#ffffff', 3);
    await usuario.clear(entrada);
    await usuario.type(entrada, '101010');

    // A chave e a cor **de origem**, nao o valor digitado: e ela que o renderer
    // procura no markup. As outras cores seguem intactas.
    const ultima = chamadas[chamadas.length - 1];
    expect(ultima?.valor).toEqual({ '#ff8800': '#00ff00', '#ffffff': '#101010' });
    // Arrastar/digitar nao cria uma entrada de historico por tecla.
    expect(ultima?.transient).toBe(true);
  });

  it('converte alpha em rgba no override, como transiente', async () => {
    const usuario = userEvent.setup();
    const chamadas: Array<{ valor: Record<string, string>; transient: boolean | undefined }> = [];
    montar(undefined, (proximo, transient) => {
      chamadas.push({ valor: proximo, transient });
    });

    const alpha = screen.getByLabelText(
      'Replace #ffffff, used 3 times alpha percent'
    ) as HTMLInputElement;
    await usuario.clear(alpha);
    await usuario.type(alpha, '50');

    // O override e uma string CSS: alpha < 1 vira `rgba(...)`, nao um hex.
    const ultima = chamadas[chamadas.length - 1];
    expect(ultima?.valor).toEqual({ '#ffffff': 'rgba(255, 255, 255, 0.5)' });
    // Digitar no alpha e edicao em andamento, igual ao hex: uma entrada por gesto.
    expect(ultima?.transient).toBe(true);
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

  it('nao mostra picker para token que o picker nao sabe ler', () => {
    // `currentcolor` resolveria para preto no `normalizeHex` do studio — e sem valor
    // ele cai em `FALLBACK_SOLID_HEX` (`#000000`), que e uma mentira. A linha mostra
    // o literal, sem campo.
    const comToken: SvgPaintColor[] = [
      { hex: 'currentcolor', count: 2, roles: ['fill'], literal: 'currentColor' }
    ];
    render(<SvgPaintEditor colors={comToken} overrides={undefined} onChange={() => {}} onCommit={() => {}} />);

    expect(screen.getByText('currentcolor')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Replace currentcolor/)).not.toBeInTheDocument();
  });
});