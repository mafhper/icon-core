import { describe, expect, it } from 'vitest';
import { defaultMaskRadius, type IconCoreProject } from '@iconcore/shared';
import { composerReducer, initialState } from './composerReducer';

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

/**
 * Cores `''` de propósito: este fixture exercita **raio e histórico**, e uma cor real
 * aqui custaria 4 hex no `check-ui-budget` — que é um ratchet que só desce. Um literal
 * de cor num teste que nao testa cor e taxa pura sobre o orcamento de quem **produz**
 * interface.
 */
const projeto = (size = 512): IconCoreProject =>
  ({
    schemaVersion: 3,
    metadata: { name: 'X', shortName: 'X' },
    canvas: { size },
    variants: {
      default: { background: '', layers: [] },
      light: { background: '', layers: [] },
      dark: { background: '', layers: [] },
      mono: { background: '', layers: [] }
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

/**
 * Plataforma e raio: o contrato de `maskRadius`.
 *
 * `maskRadius` ausente **significa** "siga a forma" — e e assim que `resolveMaskRadius`
 * decide. Entao trocar a plataforma com o raio intocado tem de mover o valor, e trocar
 * com o raio **declarado** tem de preservar o declarado.
 *
 * A segunda metade e o teste que vale: um app que apaga o raio a cada troca de
 * plataforma obriga a refazer o ajuste, e quem nunca ajustou nao notaria — que e
 * exatamente por isso que este par de testes precisa existir junto.
 */
describe('frame radius — trocar a plataforma move o slider', () => {
  const radius = (s: ReturnType<typeof composerReducer>) =>
    s.project!.canvas.maskRadius ?? defaultMaskRadius(s.maskShape, s.project!.canvas.size);

  it('raio intocado: circle leva a size/2, square leva a 4', () => {
    const base = comProjeto(512);
    expect(radius(base)).toBe(24); // rounded-rectangle

    const circulo = composerReducer(base, { type: 'SET_MASK_SHAPE', payload: 'circle' });
    expect(radius(circulo)).toBe(256);

    const quadrado = composerReducer(circulo, { type: 'SET_MASK_SHAPE', payload: 'square' });
    expect(radius(quadrado)).toBe(4);
  });

  it('raio declarado: a troca de plataforma **nao** apaga o ajuste', () => {
    const ajustado = composerReducer(comProjeto(512), {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    const circulo = composerReducer(ajustado, { type: 'SET_MASK_SHAPE', payload: 'circle' });

    expect(radius(circulo)).toBe(40);
    // E o campo continua declarado, para o "Reset" ter o que reverter.
    expect(circulo.project!.canvas.maskRadius).toBe(40);
  });

  it('declarado e depois resetado: volta a seguir a forma', () => {
    const ajustado = composerReducer(comProjeto(512), {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    const resetado = composerReducer(ajustado, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: null }
    });
    const circulo = composerReducer(resetado, { type: 'SET_MASK_SHAPE', payload: 'circle' });

    expect(resetado.project!.canvas.maskRadius).toBeUndefined();
    expect(radius(circulo)).toBe(256);
  });

  it('squircle tem o proprio padrao, e ele e o mesmo da keyline', () => {
    // 0.2237 * 512 = 114.5 — o mesmo `defaultMaskRadius` que o `KeylineOverlay` usa,
    // entao guia e frame nao podem divergir.
    const s = composerReducer(comProjeto(512), { type: 'SET_MASK_SHAPE', payload: 'squircle' });
    expect(radius(s)).toBeCloseTo(512 * 0.2237, 5);
  });
});