import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import { createBlankProject, createShapeLayer } from './utils/projectFactory';

/**
 * `REORDER_LAYER` — a acao que o **arrastar** despacha.
 *
 * ## O buraco que estes testes cobrem
 *
 * O dono reportou: *"a ordenação acontece se eu fizer pelo botão direito e enviar para baixo
 * ou cima. Não dá certo se eu clicar e arrastar na camada."*
 *
 * O motivo estava no meu proprio historico. O bug do `moveLayer` — que o **menu** usa — foi
 * descoberto, corrigido e coberto por 12 testes unitarios e 4 e2e. `REORDER_LAYER`, que o
 * **arrastar** usa, e uma acao **diferente** no reducer, e nao tinha **nenhum** teste. Os
 * 4 e2e de `layer-reorder` usavam todos o menu de contexto.
 *
 * Entao a frase "os tres caminhos existem" era uma frase escrita sem ter exercitado um deles.
 *
 * ## O defeito
 *
 * `reorderLayers` — usada por `ADD_LAYER`, `REMOVE_LAYER` e o carregamento — ordena por
 * `zIndex` **antes** de renumerar. E o certo quando o array nao tem opiniao: quem sabe a
 * ordem e o `zIndex` que cada camada ja carregava.
 *
 * Depois de um `REORDER_LAYER` o array **e** a opiniao: o splice acabou de declarar a ordem
 * que a pessoa quer. Passar por `reorderLayers` ordenava de novo pelo `zIndex` antigo e
 * **descartava** essa opiniao — a acao embaralhava o array, a renumeracao devolvia os
 * mesmos numeros, e a lista nao mudava. Um no-op.
 *
 * A correcao e `renumberInPlace`: renumera pela posicao do array. O Background continua
 * preso em -1 e no fim.
 *
 * ## A convencao de `newIndex`, que estes testes fixam
 *
 * `newIndex` e uma vaga no array **ascendente** (`zIndex` crescendo), medida **depois** da
 * remocao da camada arrastada — que e o que `splice` faz.
 *
 * A lista na tela e **descendente** (frente em cima). Sao o mesmo conjunto invertido, e com o
 * handle de Background em posicoes opostas: no fim da lista, na vaga 0 do array.
 *
 * ```
 *   lista na tela   [S2, S1, S0, Background]
 *   array           [Background, S0, S1, S2]
 *                     vaga 0      1  2  3
 * ```
 *
 * Entao, **com** o handle, o conteudo ocupa as vagas 1..n: o topo da lista e a vaga `n`, e
 * nao `n - 1`. **Sem** o handle o conteudo ocupa 0..n-1.
 *
 * A versao anterior de `LayerList.reorder` fazia a conta na lista e refletia no fim
 * (`next.length - 1 - next.indexOf(...)`). Sem o handle os dois frames tem o mesmo tamanho e
 * a reflexao acerta por acaso; com o handle os espacos nao coincidem e o arrasto errava um
 * degrau. Por isso quase todo teste aqui cria o handle.
 */

/** Um estado com `n` shapes e, opcionalmente, o handle de Background. */
const comCamadas = (n: number, comFundo = true) => {
  const base = createBlankProject('x');
  const size = base.canvas.size;
  const layers = Array.from({ length: n }, (_, i) => ({
    ...createShapeLayer(size, i),
    name: `S${i}`
  }));
  let state = composerReducer(initialState, {
    type: 'LOAD_PROJECT',
    payload: { project: { ...base, layers }, view: 'edit-space' }
  });
  if (comFundo) {
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { kind: 'background' } });
  }
  return state;
};

/** Os nomes na ordem da **lista** (`zIndex` descendente) — o que a pessoa ve. */
const naLista = (state: ReturnType<typeof composerReducer>): string[] =>
  [...(state.project!.layers as { name: string; zIndex: number }[])]
    .sort((a, b) => b.zIndex - a.zIndex)
    .map((l) => l.name);

const idDe = (state: ReturnType<typeof composerReducer>, nome: string) =>
  (state.project!.layers as { id: string; name: string }[]).find((l) => l.name === nome)!.id;

const reordenar = (state: ReturnType<typeof composerReducer>, nome: string, newIndex: number) =>
  composerReducer(state, {
    type: 'REORDER_LAYER',
    payload: { id: idDe(state, nome), newIndex }
  });

describe('REORDER_LAYER — a acao do arrasto', () => {
  /**
   * A reproducao exata do bug reportado.
   *
   * A instrumentacao do arrasto no navegador registrou, para tres camadas **sem** o handle,
   * arrastando a de baixo para a de cima:
   *
   *     order    = [T3, T2, T1]    (a lista, descendente)
   *     from = 2, to = 0
   *     next      = [T1, T3, T2]   (com T1 ja no topo da lista)
   *     newIndex  = 2
   *
   * Entao o `newIndex` que o arrasto mandava era **2**, e a expectativa e que T1 virasse a do
   * topo. Antes da correcao o reducer devolvia a lista **igual** — o no-op.
   */
  it('REPRODUCAO: newIndex 2 manda a camada de baixo para o topo', () => {
    const state = comCamadas(3, false);
    expect(naLista(state)).toEqual(['S2', 'S1', 'S0']);
    expect(naLista(reordenar(state, 'S0', 2))).toEqual(['S0', 'S2', 'S1']);
  });

  it('sobe uma camada de um degrau', () => {
    const state = comCamadas(3);
    // Content nas vagas 1..3 porque o Background ocupa a vaga 0. S0 sobe da vaga 1 para a 2.
    expect(naLista(state)).toEqual(['S2', 'S1', 'S0', 'Background']);
    expect(naLista(reordenar(state, 'S0', 2))).toEqual(['S2', 'S0', 'S1', 'Background']);
  });

  it('desce uma camada de um degrau', () => {
    const state = comCamadas(3);
    // S2 desce da vaga 3 para a 2.
    expect(naLista(state)).toEqual(['S2', 'S1', 'S0', 'Background']);
    expect(naLista(reordenar(state, 'S2', 2))).toEqual(['S1', 'S2', 'S0', 'Background']);
  });

  it('vai para o topo', () => {
    const state = comCamadas(3);
    /**
     * O topo da lista e a **ultima** vaga do array ascendente, que e o numero de camadas de
     * conteudo — e nao `conteudo - 1`: o Background ja ocupou a vaga 0.
     *
     * A primeira versao deste teste usava `conteudo - 1` e falhava em exatamente um degrau.
     * Era o teste errado, e nao o codigo: o reducer estava certo e a expectativa media a
     * convencao errada.
     */
    const conteudo = state.project!.layers.filter((l) => l.role !== 'background').length;
    expect(naLista(reordenar(state, 'S0', conteudo))).toEqual(['S0', 'S2', 'S1', 'Background']);
  });

  it('vai para baixo de tudo, mas continua acima do Background', () => {
    const state = comCamadas(3);
    // A vaga 0 e do Background; `renumberInPlace` o devolve para -1 e para o fim do array,
    // entao S2 fica no fundo da composicao — e o handle continua abaixo dele.
    expect(naLista(reordenar(state, 'S2', 0))).toEqual(['S1', 'S0', 'S2', 'Background']);
  });

  it('o Background fica em -1 e por ultimo na lista, seja qual for o newIndex', () => {
    // O teste que pega o arrasto atravessando o handle: com ele presente, o espaco de
    // indices da lista e o do array nao coincidem, e um Background que suba para o topo e
    // o sintoma.
    for (const novo of [0, 1, 2, 3, 99]) {
      const depois = reordenar(comCamadas(3), 'S1', novo);
      const bg = depois.project!.layers.find((l) => l.role === 'background')!;
      expect(bg.zIndex, `newIndex ${novo} moveu o Background para ${bg.zIndex}`).toBe(-1);
      expect(naLista(depois).at(-1)).toBe('Background');
    }
  });

  it('nunca produz dois zIndex iguais', () => {
    const state = comCamadas(4);
    for (const nome of ['S0', 'S1', 'S2', 'S3']) {
      for (const novo of [0, 1, 2, 3, 4, 5]) {
        const depois = reordenar(state, nome, novo);
        const zs = depois.project!.layers.map((l) => l.zIndex);
        expect(new Set(zs).size, `${nome} -> ${novo} produziu zIndex repetido: ${zs}`).toBe(zs.length);
      }
    }
  });

  it('funciona tambem sem o handle de Background', () => {
    // Sem o handle, o conteudo ocupa as vagas 0..n-1: o topo e `n - 1`, e nao `n`. A
    // convencao muda com o handle, e por isso os dois casos precisam de teste.
    const state = comCamadas(3, false);
    expect(naLista(state)).toEqual(['S2', 'S1', 'S0']);
    expect(naLista(reordenar(state, 'S0', 2))).toEqual(['S0', 'S2', 'S1']);
  });

  it('desfaz: voltar a vaga de origem restaura a ordem', () => {
    const state = comCamadas(4);
    const antes = naLista(state);
    const conteudo = antes.filter((n) => n !== 'Background').length;

    const subi = reordenar(state, 'S0', conteudo);
    const voltou = reordenar(subi, 'S0', 1);
    expect(naLista(voltou)).toEqual(antes);
  });

  it('ignora um id desconhecido, sem tocar no documento', () => {
    const state = comCamadas(3);
    const antes = naLista(state);
    const depois = composerReducer(state, {
      type: 'REORDER_LAYER',
      payload: { id: 'nao-existe', newIndex: 0 }
    });
    expect(naLista(depois)).toEqual(antes);
  });

  it('um newIndex fora da faixa nao corrompe: o splice limita', () => {
    // Antes do clamp, `splice(99, 0, x)` num array de 2 era aceito e jogava a camada no
    // fim; um `newIndex` negativo, nao. O clamp torna os dois o mesmo caso.
    const state = comCamadas(3);
    for (const novo of [-5, 0, 99]) {
      const depois = reordenar(state, 'S1', novo);
      const zs = depois.project!.layers.map((l) => l.zIndex);
      expect(new Set(zs).size, `newIndex ${novo} produziu zIndex repetido: ${zs}`).toBe(zs.length);
      expect(naLista(depois).at(-1)).toBe('Background');
      expect(naLista(depois)).toHaveLength(4);
    }
  });
});
