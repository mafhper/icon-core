import { describe, expect, it } from 'vitest';
import type { TextDefinition } from '@iconcore/shared';
import { composerReducer, initialState } from './composerReducer';

/**
 * `IC63/2` — o campo novo sobrevive ao **reducer**.
 *
 * A mutação que mais importa desta rodada escapou: fazendo `applyLayerChanges` **descartar**
 * `textAlign` e `fontStyle`, `composerReducer.spec.ts` continuava **verde**. A UI ficaria
 * inteira, o painel mostraria o botão, o preview não mudaria, e nada quebraria.
 *
 * É a mesma classe do `IC63/1b` (o `Fill` que não fazia nada) e do id do projeto no
 * #202: as suítes do outro lado estavam verdes, e o defeito estava na emenda. Aqui a
 * emenda é entre o dispatch da interface e o estado.
 *
 * E a razão de o reducer merecer teste próprio: os testes do renderer provam que
 * `textAlign` chega ao `<text>` **a partir de um estado que já o tem**. Nenhum deles passa
 * pelo `UPDATE_LAYER`, que é onde o campo entra.
 */
/**
 * Um projeto com **uma layer de texto**, e o índice dela.
 *
 * `NEW_PROJECT` já cria um Background em `layers[0]`, então a layer de texto é a
 * **última**. A primeira versão deste arquivo pegava `layers[0]` — o Background — e
 * mutava um `text` que não existe ali; o reducer aceita qualquer `changes`, então o
 * teste rodava em cima da layer errada e falhava por motivo errado.
 *
 * `role: 'background'` é a identificação semântica, e é assim que o próprio repositório
 * manda reconhecer a layer (`IconLayer.role`, `shared/src/index.ts:181`).
 */
const comTexto = (): { state: ReturnType<typeof composerReducer>; indice: number } => {
  const base = composerReducer(initialState, {
    type: 'NEW_PROJECT',
    payload: { name: 'Com texto', size: 512, view: 'edit-space' }
  });

  // `ADD_LAYER` **não** recebe uma layer pronta: o payload é `{ text: true }` e o
  // reducer chama `createTextLayer` (`composerReducer.ts:68`). A primeira versão deste
  // arquivo passou `{ layer: createTextLayer(512, 0) }` — um payload que o tipo não
  // descreve, e que produz um projeto **sem** layer de texto. O TypeScript aceitou
  // porque `payload` é um objeto com campos opcionais, e `layer` é simplesmente ignorado.
  const estado = composerReducer(base, {
    type: 'ADD_LAYER',
    payload: { text: true }
  });

  const indice = estado.project!.layers.findIndex((l) => l.kind === 'text');
  if (indice === -1) throw new Error('nenhuma layer de texto foi criada');
  return { state: estado, indice };
};

/**
 * O `text` da layer, garantidamente presente.
 *
 * A primeira versão devolvia `TextDefinition | undefined`, e o spread de um tipo
 * opcional produz `{ textAlign: 'left'; content?: string; … }` — que o TypeScript recusa
 * em `TextDefinition`, porque todos os campos obrigatórios viraram opcionais. Três
 * asserções quebraram por isso, e a correção é o helper, não `as any`.
 */
const textoDe = (estado: ReturnType<typeof composerReducer>, indice: number): TextDefinition => {
  const texto = estado.project!.layers[indice].text;
  if (!texto) throw new Error(`a layer ${indice} nao tem text`);
  return texto;
};

describe('o campo de texto atravessa o reducer', () => {
  it('UPDATE_LAYER grava textAlign na layer de texto', () => {
    const { state, indice } = comTexto();
    const id = state.project!.layers[indice].id;

    const depois = composerReducer(state, {
      type: 'UPDATE_LAYER',
      payload: {
        id,
        transient: true,
        changes: { text: { ...textoDe(state, indice), textAlign: 'left' } }
      }
    });

    expect(textoDe(depois, indice)?.textAlign).toBe('left');
    // E o resto do texto sobrevive — o merge é de `text`, não do layer inteiro.
    expect(textoDe(depois, indice)?.content).toBe(textoDe(state, indice)?.content);
    expect(textoDe(depois, indice)?.fontSize).toBe(textoDe(state, indice)?.fontSize);
    expect(textoDe(depois, indice)?.fontWeight).toBe(textoDe(state, indice)?.fontWeight);
  });

  it('UPDATE_LAYER grava fontStyle na layer de texto', () => {
    const { state, indice } = comTexto();
    const id = state.project!.layers[indice].id;

    const depois = composerReducer(state, {
      type: 'UPDATE_LAYER',
      payload: {
        id,
        transient: true,
        changes: { text: { ...textoDe(state, indice), fontStyle: 'italic' } }
      }
    });

    expect(textoDe(depois, indice)?.fontStyle).toBe('italic');
  });

  it('voltar de left para center não deixa resíduo', () => {
    // O botão de alinhamento é alternável: ir a `left` e voltar tem que devolver o texto
    // **exatamente** como estava. A asserção é sobre os campos **compartilhados**, e não
    // sobre o objeto inteiro — porque `textAlign` é justamente o campo que passou a
    // existir, e comparar o objeto todo só diria "algo mudou", que é o oposto do que
    // este teste precisa provar.
    const { state, indice } = comTexto();
    const id = state.project!.layers[indice].id;

    const comLeft = composerReducer(state, {
      type: 'UPDATE_LAYER',
      payload: { id, transient: true, changes: { text: { ...textoDe(state, indice), textAlign: 'left' } } }
    });
    expect(textoDe(comLeft, indice)?.textAlign).toBe('left');

    const comCenter = composerReducer(comLeft, {
      type: 'UPDATE_LAYER',
      payload: { id, transient: true, changes: { text: { ...textoDe(comLeft, indice), textAlign: 'center' } } }
    });
    expect(textoDe(comCenter, indice)?.textAlign).toBe('center');

    // Tudo o mais volta ao que era.
    for (const campo of ['content', 'fontFamily', 'fontSize', 'fontWeight'] as const) {
      expect(textoDe(comCenter, indice)?.[campo]).toBe(textoDe(state, indice)?.[campo]);
    }
  });

  it('a variante recebe o alinhamento sem apagar o texto do base', () => {
    // `UPDATE_LAYER_VARIANT` guarda o override da variante. Se o merge de `text` deixar
    // de ser spread, a variante que muda só o alinhamento volta ao `center` do base — e
    // a pessoa vê o texto centralizar ao trocar de variante, sem erro.
    const { state, indice } = comTexto();
    const id = state.project!.layers[indice].id;
    const base = textoDe(state, indice)!;

    const comVariante = composerReducer(state, {
      type: 'UPDATE_LAYER_VARIANT',
      payload: {
        id,
        variant: 'dark',
        transient: true,
        changes: { text: { ...base, textAlign: 'right' } }
      }
    });

    const variant = comVariante.project!.layers[indice].variantOverrides?.dark;
    expect(variant?.text?.textAlign).toBe('right');
    // O conteúdo vem do base, não de um `text` reconstruído sem ele.
    expect(variant?.text?.content).toBe(base.content);
    expect(variant?.text?.fontSize).toBe(base.fontSize);
    // E o layer base **não** foi tocado: é o que uma variante significa.
    expect(textoDe(comVariante, indice)?.textAlign).toBeUndefined();
  });

  it('a alteração marca o projeto como sujo, para o autosave gravar', () => {
    // Sem isto o texto mudaria na tela e nunca chegaria ao armazenamento — e o
    // alinhamento voltaria ao `center` na sessão seguinte. É a mesma classe do
    // `SET_PROJECT_NAME`, que já tem teste.
    const { state, indice } = comTexto();
    const id = state.project!.layers[indice].id;

    const depois = composerReducer(state, {
      type: 'UPDATE_LAYER',
      payload: { id, transient: true, changes: { text: { ...textoDe(state, indice), textAlign: 'left' } } }
    });

    expect(depois.isDirty).toBe(true);
  });
});
