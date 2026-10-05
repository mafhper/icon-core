import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import type { IconCoreProject } from '@iconcore/shared';

/**
 * O slider de "Frame radius" nao tinha teste. Um controle que grava no documento,
 * com um `Reset` que depende de `maskRadius === undefined`, e exatamente o tipo de
 * coisa que funciona no dev e nao funciona depois do autosave.
 *
 * O que estes testes seguram:
 * 1. o raio **sobrescreve** o padrao da forma;
 * 2. `null` volta ao padrao da forma;
 * 3. o clamp em metade do lado existe porque alem disso os cantos se cruzam;
 * 4. `transient` marca dirty sem empilhar historico, e o commit empilha uma vez.
 */

const projeto = (size = 512): IconCoreProject =>
  ({
    schemaVersion: 3,
    metadata: { name: 'X', shortName: 'X' },
    canvas: { size },
    variants: {
      default: { background: '#000000', layers: [] },
      light: { background: '#ffffff', layers: [] },
      dark: { background: '#000000', layers: [] },
      mono: { background: '#000000', layers: [] }
    }
  }) as unknown as IconCoreProject;

const comProjeto = (size = 512) => ({
  ...initialState,
  project: projeto(size),
  projectId: 'p1',
  view: 'edit-space' as const
});

describe('frame radius — o slider que nao tinha teste', () => {
  it('grava o raio no documento e sobrescreve o padrao da forma', () => {
    const antes = comProjeto();
    expect(antes.project!.canvas.maskRadius).toBeUndefined();

    const depois = composerReducer(antes, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });

    expect(depois.project!.canvas.maskRadius).toBe(40);
    expect(depois.isDirty).toBe(true);
  });

  it('`null` limpa o campo, e o padrao da forma volta', () => {
    const comRaio = composerReducer(comProjeto(), {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    const resetado = composerReducer(comRaio, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: null }
    });

    // `undefined` e nao `null`: e assim que `resolveMaskRadius` sabe para cair no
    // padrao, e assim que o botao Reset sabe que ha algo para reverter.
    expect(resetado.project!.canvas.maskRadius).toBeUndefined();
  });

  it('clampa em metade do lado — alem disso os cantos se cruzam', () => {
    const depois = composerReducer(comProjeto(512), {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 9999, transient: true }
    });
    expect(depois.project!.canvas.maskRadius).toBe(256);
  });

  it('clampa em zero pelo lado de baixo', () => {
    const depois = composerReducer(comProjeto(), {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: -50, transient: true }
    });
    expect(depois.project!.canvas.maskRadius).toBe(0);
  });

  it('`transient` nao empilha historico; o commit empilha uma vez', () => {
    const antes = comProjeto();
    const durante = composerReducer(antes, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    expect(durante.history.length).toBe(antes.history.length);

    const depois = composerReducer(durante, { type: 'COMMIT_HISTORY' });
    expect(depois.history.length).toBe(antes.history.length + 1);
  });

  it('sem projeto, o raio nao faz nada', () => {
    const depois = composerReducer(initialState, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    expect(depois).toBe(initialState);
  });
});