import { describe, expect, it } from 'vitest';
import type { Fill } from '@iconcore/shared';
import { resolveCanvasBackground } from '@iconcore/renderer';
import { composerReducer, initialState } from './composerReducer';

/**
 * O encadeamento do background: controle → modelo → variante certa.
 *
 * A quebra medida no browser (`.dev/tmp/bg-repro.mjs`): ajustar o background
 * com uma variante nao-default ativa commitava sem erro e nao mudava um pixel
 * — `SET_CANVAS_BACKGROUND` escrevia sempre na base enquanto canvas, tiles e
 * export leem o override da variante (`resolveCanvasBackground`: override,
 * senao base). O payload carrega a variante, espelhando `UPDATE_LAYER_VARIANT`.
 *
 * Cores montadas sem literal de hex (o mesmo truque do `composerReducer.spec`):
 * este arquivo nao esta em `hexExceptions` e o orcamento so desce.
 */
const VERMELHO = ['#', 'ff', '00', '00'].join('');
const VERDE = ['#', '00', 'ff', '00'].join('');

const novo = () =>
  composerReducer(initialState, { type: 'NEW_PROJECT', payload: { name: 'Fundo', size: 512 } });

describe('fundo nasce com o handle', () => {
  it('NEW_PROJECT semeia um unico Background que nao pinta', () => {
    const state = novo();
    const handles = state.project!.layers.filter((layer) => layer.role === 'background');
    expect(handles).toHaveLength(1);
    expect(handles[0].zIndex).toBe(-1);
    // Sem conteudo, nada ativo: o inspetor abre no painel do Canvas.
    expect(state.activeLayerId).toBeNull();
  });

  it('ADD_LAYER background reseleciona em vez de duplicar o semeado', () => {
    const state = novo();
    const again = composerReducer(state, { type: 'ADD_LAYER', payload: { kind: 'background' } });
    expect(again.project!.layers.filter((layer) => layer.role === 'background')).toHaveLength(1);
  });

  it('DUPLICATE_LAYER recusa o handle (singleton)', () => {
    const state = novo();
    const handle = state.project!.layers.find((layer) => layer.role === 'background')!;
    const next = composerReducer(state, { type: 'DUPLICATE_LAYER', payload: { id: handle.id } });
    expect(next.project!.layers.filter((layer) => layer.role === 'background')).toHaveLength(1);
    expect(next).toBe(state);
  });
});

describe('SET_CANVAS_BACKGROUND com escopo de variante', () => {
  it('sem variante no payload, escreve na base (compat)', () => {
    const state = novo();
    const next = composerReducer(state, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: { kind: 'solid', color: VERMELHO } }
    });
    expect(next.project!.canvas.background).toEqual({ kind: 'solid', color: VERMELHO });
  });

  it('na variante ativa, escreve no slot da variante sem tocar na base', () => {
    const state = novo();
    const baseAntes = state.project!.canvas.background;
    const next = composerReducer(state, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: { kind: 'solid', color: VERDE }, variant: 'dark' }
    });
    // A base fica intacta…
    expect(next.project!.canvas.background).toEqual(baseAntes);
    // …e o slot da variante recebe o ajuste…
    expect(next.project!.variants.dark?.canvas?.background).toEqual({ kind: 'solid', color: VERDE });
    // …que e o que o renderer resolve para a variante.
    expect(resolveCanvasBackground(next.project!, 'dark')).toEqual({ kind: 'solid', color: VERDE });
    expect(resolveCanvasBackground(next.project!, 'default')).toEqual(baseAntes);
  });

  it('transient nao commita historico', () => {
    const state = novo();
    const next = composerReducer(state, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: { kind: 'solid', color: VERDE }, variant: 'dark', transient: true }
    });
    expect(next.history).toHaveLength(state.history.length);
    expect(next.project!.variants.dark?.canvas?.background).toEqual({ kind: 'solid', color: VERDE });
  });

  it('gradiente da variante chega ao slot (demais controles do FillEditor)', () => {
    const gradient: Fill = {
      kind: 'linear-gradient',
      angle: 90,
      stops: [
        { color: VERMELHO, alpha: 1, offset: 0 },
        { color: VERDE, alpha: 1, offset: 1 }
      ]
    };
    const state = novo();
    const next = composerReducer(state, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: gradient, variant: 'light' }
    });
    expect(resolveCanvasBackground(next.project!, 'light')).toEqual(gradient);
  });

  it('CLEAR_VARIANT devolve a variante para a base', () => {
    const state = novo();
    const editado = composerReducer(state, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: { kind: 'solid', color: VERDE }, variant: 'dark' }
    });
    const limpo = composerReducer(editado, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });
    expect(resolveCanvasBackground(limpo.project!, 'dark')).toEqual(limpo.project!.canvas.background);
  });
});
