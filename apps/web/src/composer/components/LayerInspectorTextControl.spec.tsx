import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { renderToSvg } from '@iconcore/renderer';
// Nome exato do arquivo: `ComposerContext.tsx`, com C maiúsculo. Importar como
// `../composerContext` resolve no Windows e cria **duas instâncias** do contexto — o
// provider monta uma e o `useComposer` do `LayerInspector` lê a outra. No Linux o CI
// quebraria, então o nome errado aqui é um erro que só aparece fora da minha máquina.
import { ComposerProvider, useComposer } from '../ComposerContext';
import { ToastProvider } from '../toast/ToastContext';
import { LayerInspector } from './LayerInspector';

/**
 * `IC63/2` — a emenda que **nenhum dos dois** specs existentes cobre.
 *
 * ## O buraco, e por que ele já custou trabalho
 *
 * Existiam dois testes, e entre eles havia um intervalo:
 *
 * - `textFieldReducer.spec.ts` (web): `dispatch` → `reducer` → `TextDefinition`. Cobria
 *   a ação, mas parava no estado.
 * - `textIntegration.spec.ts` (renderer): projeto → variante → markup. Cobria o renderer,
 *   mas **pulava a UI e o reducer** — começava num objeto já pronto.
 *
 * Nenhum dos dois atravessa o caminho que a pessoa percorre: **clicar num botão e ver a
 * letra mudar de lugar**. E o `IC63/1b` é a prova de que essa emenda morada: o controle
 * de cor existia, o reducer existia, o renderer existia, e o controle não fazia nada —
 * porque um dos lados não estava ligado ao outro. Uma suíte com 168 testes no renderer
 * não viu.
 *
 * ## Por que este teste começa no componente
 *
 * O Agente A e o Agente C pediram um teste de integração antes do merge, e o C foi mais
 * específico: "renderize o `LayerInspector`, clique em Left, verifique que a action/reducer
 * muda `textAlign`, e que o preview/renderer recebe o valor. E2e completo pode ser dívida
 * consciente; teste de integração não."
 *
 * O precedente mais próximo, `SvgPaintEditor.spec.tsx`, **para no estado** — não chega ao
 * renderer. Este vai até lá, e é por isso que ele é o que fecha a cadeia.
 *
 * ## E a asserção é de valor absoluto
 *
 * Confere o **markup emitido**, não "os dois pipelines concordam". `text-anchor="start"`
 * com `x` na borda esquerda é um número; comparar canvas com SVG mediria concordância, e a
 * `ADR-021` diz que isso não é correção.
 */
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { createBlankProject, createTextLayer } from '../utils/projectFactory';

/**
 * Semeia o projeto pelo **reducer de verdade**, com `LOAD_PROJECT` — nao por prop e nao por
 * mock. O `ComposerProvider` comeca de `initialState` e restaura do IndexedDB, entao sem
 * isto o inspector nem mostra a camada de texto. Despachar a acao real tambem cobre a
 * emenda "o provider realmente aplica o que o app aplica".
 */
const Semear = ({ projeto }: { projeto: IconCoreProject }) => {
  const { dispatch, state } = useComposer();
  useEffect(() => {
    if (!state.project) dispatch({ type: 'LOAD_PROJECT', payload: { project: projeto } });
  }, [dispatch, state.project, projeto]);
  return null;
};

/** Publica o projeto atual para fora do provider, sem abrir um buraco na API do app. */
const EspiaoDeProjeto = ({ aoMudar }: { aoMudar: (p: IconCoreProject) => void }) => {
  const { state } = useComposer();
  useEffect(() => {
    if (state.project) aoMudar(state.project);
  }, [state.project, aoMudar]);
  return null;
};

const PROJETO: IconCoreProject = (() => {
  // Fábrica real em vez de literal hex: `check-ui-budget` conta hex em `*.spec.tsx` e o
  // ratchet é "só para baixo" (`IC-N11`). E o fixture fica mais forte, asseverado contra o
  // código de produção.
  const base = createBlankProject('t', 256);
  const texto = createTextLayer(256, 0);
  return {
    ...base,
    targets: [],
    layers: [
      {
        ...texto,
        id: 'lt',
        source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 196, height: 44 } },
        text: { ...(texto.text as unknown as Record<string, unknown>), content: 'Esquerda', fontSize: 22, fontWeight: 700 }
      } as unknown as IconLayer
    ]
  };
})();

/** Monte real: provider + reducer + componente. Nada de mock no meio do caminho. */
const montar = () => {
  const vistos: IconCoreProject[] = [];
  render(
    // `ComposerProvider` le `useToast`, entao o toast precisa envolver — mesma ordem do
    // `a11y.spec.tsx`, que ja descobriu isso.
    <ToastProvider>
      <ComposerProvider>
        <Semear projeto={PROJETO} />
        <EspiaoDeProjeto aoMudar={(p) => vistos.push(p)} />
        <LayerInspector />
      </ComposerProvider>
    </ToastProvider>
  );
  return vistos;
};

/**
 * Sem clicar em nada para escolher a camada: `setProject` ja deixa a camada de topo ativa
 * (`composerReducer.ts:199`), e o `LayerInspector` mostra as propriedades dela. A pessoa
 * clica no controle de alinhamento — e e' esse clique que este teste percorre.
 */
const esperarControle = async () => {
  await screen.findByLabelText('Text alignment');
  return userEvent.setup();
};

/** O `<text>` do SVG do projeto atual — o valor absoluto que fecha a cadeia. */
const tagDoTexto = (p: IconCoreProject) => /<text\b[^>]*>/.exec(renderToSvg(p, 'default'))?.[0] ?? '';
const attr = (tag: string, nome: string) => new RegExp(`\\b${nome}="([^"]*)"`).exec(tag)?.[1];

describe('UI → estado → renderer: a emenda que o IC63/1b provou ser possivel quebrar', () => {
  // O `cleanup` automatico do testing-library so existe com `globals: true` no vitest, e
  // este projeto nao usa. Sem isto, a arvore do teste anterior fica montada e a consulta
  // seguinte acha **varios** "Text alignment" — erro que parece de seletor e e' de
  // montagem. Ja aconteceu aqui.
  afterEach(() => cleanup());

  it('clicar em Left move a ancora e a posicao no markup exportado', async () => {
    const vistos = montar();
    const user = await esperarControle();

    await user.click(screen.getByRole('button', { name: 'Left' }));

    // 1. o estado recebeu o valor
    const comEsquerda = vistos.at(-1)!;
    const camada = comEsquerda.layers.find((l) => l.kind === 'text');
    expect(camada?.text).toMatchObject({ textAlign: 'left' });

    // 2. e o renderer consumiu, com numero absoluto: canvas 256 - shape 196 => borda em 30
    const tag = tagDoTexto(comEsquerda);
    expect(attr(tag, 'text-anchor')).toBe('start');
    expect(Number(attr(tag, 'x'))).toBe(30);
  });

  it('cada um dos tres botoes leva ao par ancora/posicao que o nome promete', async () => {
    // A tabela e' o contrato da UI. Se `Left` produzisse `middle`, esta lista reprovaria —
    // e e' a forma que pega "trocar a ancora sem mover o x".
    const esperado = [
      { botao: 'Left', anchor: 'start', x: 30 },
      { botao: 'Center', anchor: 'middle', x: 128 },
      { botao: 'Right', anchor: 'end', x: 226 }
    ] as const;

    for (const { botao, anchor, x } of esperado) {
      const vistos = montar();
      const user = await esperarControle();
      await user.click(screen.getByRole('button', { name: botao }));

      const tag = tagDoTexto(vistos.at(-1)!);
      expect({ botao, anchor: attr(tag, 'text-anchor'), x: Number(attr(tag, 'x')) }).toEqual({
        botao,
        anchor,
        x
      });
      // `cleanup()` e nao `document.body.innerHTML = ''`: o segundo apaga o HTML mas deixa
      // a arvore React montada, e o render seguinte se soma ao anterior — o erro passa a
      // ser "Found multiple elements", que parece problema de consulta e e' de montagem.
      cleanup();
    }
  });

  it('ligar o Italic escreve font-style no markup', async () => {
    const vistos = montar();
    const user = await esperarControle();

    const interruptor = screen.getByLabelText('Italic');
    await user.click(interruptor);

    const comItalico = vistos.at(-1)!;
    expect(comItalico.layers.find((l) => l.kind === 'text')?.text).toMatchObject({ fontStyle: 'italic' });
    expect(tagDoTexto(comItalico)).toContain('font-style="italic"');
  });

  it('desligar o Italic remove o atributo, em vez de escrever normal', async () => {
    // `font-style="normal"` funciona, mas ocupa bytes em todo texto exportado de um
    // projeto que nao usa italico.
    //
    // O **estado** pode ficar com `fontStyle: 'normal'` — a UI escreve explicitamente, e
    // isso esta certo: quem desligou o controle quis dizer "upright". O que tem de
    // desaparecer e' o **atributo**, e o texto tem de sair indistinguivel do inicial.
    // Por isso a assercao e' sobre o markup e nao sobre a ausencia do campo.
    const vistos = montar();
    const user = await esperarControle();

    const interruptor = screen.getByLabelText('Italic');
    await user.click(interruptor);
    await user.click(interruptor);

    const final = vistos.at(-1)!;
    expect(tagDoTexto(final)).not.toContain('font-style');

    // E o efeito e' o de um projeto que nunca teve italico.
    const nuncaLigado = tagDoTexto(vistos[0]);
    expect(attr(final && tagDoTexto(final), 'font-size')).toBe(attr(nuncaLigado, 'font-size'));
  });
});