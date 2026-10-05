import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import { createBlankProject, createTextLayer } from './utils/projectFactory';
import type { IconLayer } from '@iconcore/shared';

/**
 * `MOVE_LAYER` — as quatro direcoes.
 *
 * ## O que este arquivo existe para achar
 *
 * O dono reportou que nao conseguia reordenar layers. O codigo existia: `MOVE_LAYER` no
 * reducer, um menu de contexto com Bring/Send Forward/Backward, e drag na linha. E so o
 * `direction: 'back'` tinha teste — as outras tres nunca foram exercitadas.
 *
 * Um e2e (`tests/e2e/layer-reorder.spec.ts`) mostrou que `Bring Forward` **nao mudava a
 * ordem**. Este arquivo existe para localizar se o defeito e do reducer ou do consumidor.
 *
 * ## O defeito, em uma frase
 *
 * `moveLayer` fazia `splice` no **array** e depois chamava `reorderLayers` — que ordena
 * por `zIndex` antes de renumerar. O splice movia, a ordenacao devolvia ao lugar, e
 * **nenhuma das quatro direcoes fazia nada**. So `back` tinha teste, e passava por acaso.
 *
 * ## As tres armadilhas, e por que este arquivo mudou tres vezes
 *
 * 1. **O fixture.** As primeiras versoes criavam camadas com `ADD_LAYER` e renomeavam com
 *    `UPDATE_LAYER`. Cada passo empilha historico, e o `zIndex` acabava fora do que o
 *    teste supunha. Aqui as camadas sao montadas **uma vez**, com o nome e o `zIndex`
 *    que o teste quer — o alvo e `MOVE_LAYER`, nao a construcao.
 * 2. **`forward` = MAIOR `zIndex` = mais ALTO na lista**, porque a lista e descendente.
 *    A direcao do nome e a direcao visual sao **opostas**.
 * 3. **O Background aparece na lista.** Ele e um handle com `zIndex -1` que nunca pinta,
 *    mas aparece. A regra do `IC66` e sobre a **posicao**, nao sobre a presenca.
 */

/**
 * Um estado com camadas de texto nomeadas, montadas de uma vez.
 *
 * `project.layers` é a lista **real** — `variants.*.layers` são *overrides*. A primeira
 * versão deste fixture colocou as camadas nos variants, e `project.layers` ficou vazio:
 * 12 testes passando a ler `[]`. A lista que o `LayerList` mostra e a que o `MOVE_LAYER`
 * reordena é `project.layers`.
 */
const comCamadas = (nomes: string[]) => {
  const base = createBlankProject('x');
  const size = base.canvas.size;
  const layers: IconLayer[] = nomes.map((nome, i) => ({
    ...createTextLayer(size, i),
    name: nome
  }));
  return composerReducer(initialState, {
    type: 'LOAD_PROJECT',
    payload: { project: { ...base, layers }, view: 'edit-space' }
  });
};

/** Os nomes na ordem da **lista** (zIndex descendente) — o que a pessoa ve. */
const naLista = (state: ReturnType<typeof composerReducer>): string[] =>
  [...(state.project!.layers as { name: string; zIndex: number }[])]
    .sort((a, b) => b.zIndex - a.zIndex)
    .map((l) => l.name);

const idDe = (state: ReturnType<typeof composerReducer>, nome: string) =>
  (state.project!.layers as { id: string; name: string }[]).find((l) => l.name === nome)!.id;

const mover = (state: ReturnType<typeof composerReducer>, nome: string, direction: string) =>
  composerReducer(state, { type: 'MOVE_LAYER', payload: { id: idDe(state, nome), direction } as never });

const tres = () => comCamadas(['A', 'B', 'C']);
const quatro = () => comCamadas(['A', 'B', 'C', 'D']);

describe('MOVE_LAYER — as quatro direcoes', () => {
  it('a lista comeca descendente, do maior zIndex para o menor', () => {
    // A premissa de todo o arquivo. Se isto mudar, todas as expectativas abaixo mudam
    // junto — e por isso ele esta como teste, e nao como comentario.
    expect(naLista(tres())).toEqual(['C', 'B', 'A']);
  });

  it('forward sobe uma posicao na lista', () => {
    // `B` esta no meio (zIndex 1): `forward` o leva ao topo da lista.
    expect(naLista(mover(tres(), 'B', 'forward'))).toEqual(['B', 'C', 'A']);
    // `A` esta no fundo; subir um leva ao meio.
    expect(naLista(mover(tres(), 'A', 'forward'))).toEqual(['C', 'A', 'B']);
  });

  it('backward desce uma posicao na lista', () => {
    // `B` desce um degrau e `A` sobe: os dois trocaram de lugar.
    expect(naLista(mover(tres(), 'B', 'backward'))).toEqual(['C', 'A', 'B']);
  });

  it('front vai para o topo da lista', () => {
    expect(naLista(mover(tres(), 'A', 'front'))).toEqual(['A', 'C', 'B']);
  });

  it('back vai para o fim da lista', () => {
    expect(naLista(mover(tres(), 'C', 'back'))).toEqual(['B', 'A', 'C']);
  });

  it('mover no limite nao corrompe: backward no fim nao muda nada', () => {
    expect(naLista(mover(tres(), 'A', 'backward'))).toEqual(naLista(tres()));
  });

  it('front e back NAO sao inversos um do outro', () => {
    /**
     * Este teste **descoberta** algo, e nao confirma algo.
     *
     * A primeira versao afirmava que `front` seguido de `back` volta ao comeco. Nao volta:
     * `front` empurra a camada para o fim do **array**, `back` a puxa para o **inicio** —
     * e depois do `front` o inicio do array ja nao e o topo da composicao.
     *
     * Uma simulacao com `A=0 B=1 C=2 D=3`:
     *
     * ```
     * base      D C B A
     * B front   B D C A      <- topo da lista
     * B back    D C A B      <- e nao D C B A
     * ```
     *
     * Isso e defeito ou escolha? **Escolha**, e o comportamento de Figma/Illustrator: eles
     * tambem vao ao array, nao ao extremo da composicao. Nao corrigido aqui; o registro e
     * para quem for mexer aqui e achar que `front`/`back` sao um par simetrico.
     */
    const state = quatro();
    const frente = mover(state, 'B', 'front');
    expect(naLista(frente)).toEqual(['B', 'D', 'C', 'A']);
    expect(naLista(mover(frente, 'B', 'back'))).toEqual(['D', 'C', 'A', 'B']);
  });

  it('mover no limite nao corrompe: forward no topo nao muda nada', () => {
    expect(naLista(mover(tres(), 'C', 'forward'))).toEqual(naLista(tres()));
  });

  it('cada movimento e exatamente uma troca de vizinhos', () => {
    // A propriedade que pega off-by-one: dois vizinhos trocam, o resto fica.
    // lista = D C B A; `B` sobe um => D B C A.
    expect(naLista(mover(quatro(), 'B', 'forward'))).toEqual(['D', 'B', 'C', 'A']);
  });

  it('sobe tres e desce tres volta ao comeco', () => {
    const state = quatro();
    const inicial = naLista(state);
    const fundo = inicial[inicial.length - 1]; // 'A', zIndex 0

    let depois = state;
    for (let i = 0; i < 3; i++) depois = mover(depois, fundo, 'forward');
    expect(naLista(depois)[0]).toBe(fundo);

    for (let i = 0; i < 3; i++) depois = mover(depois, fundo, 'backward');
    expect(naLista(depois)).toEqual(inicial);
  });

  it('o Background aparece na lista, sempre no fim', () => {
    let state = tres();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { kind: 'background' } });

    // O Background **aparece** como handle, e fica no fim com `zIndex -1`. A primeira
    // versao afirmava o contrario e falhou: e ele aparece, e `composeLayers` e que nao o
    // pinta.
    expect(naLista(state)).toEqual(['C', 'B', 'A', 'Background']);
  });

  it('mover uma camada nao altera o zIndex do Background', () => {
    let state = tres();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { kind: 'background' } });
    const bgAntes = state.project!.layers.find((l) => l.role === 'background')!.zIndex;

    const depois = mover(state, 'A', 'front');
    const bgDepois = depois.project!.layers.find((l) => l.role === 'background')!.zIndex;

    expect(bgDepois).toBe(bgAntes);
    expect(bgDepois).toBeLessThan(0);
  });
});
