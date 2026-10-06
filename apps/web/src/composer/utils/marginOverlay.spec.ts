import { describe, expect, it } from 'vitest';
import { fitAssetSize } from './projectFactory';
import { isMarginGuideVisible, marginDash, marginGeometry } from './marginOverlay';

/**
 * Testes da geometria da máscara de margem.
 *
 * O teste que vale é o do **meio**: ele amarra a máscara à mesma expressão que
 * `fitAssetSize` usa. Sem ele, a máscara é uma segunda fórmula — e a primeira vez que
 * alguém mudar a regra de margem, a guia discorda da arte sem nenhum teste reclamar.
 */
describe('marginGeometry', () => {
  it('zero = o canvas inteiro', () => {
    const g = marginGeometry(512, 0);
    expect(g).toEqual({ width: 512, height: 512, x: 0, y: 0 });
  });

  it('20% deixa 80% de lado, centralizado', () => {
    const g = marginGeometry(512, 0.2);
    expect(g.width).toBeCloseTo(409.6, 5);
    expect(g.height).toBeCloseTo(409.6, 5);
    // Centralizado: as duas bordas iguais.
    expect(g.x).toBeCloseTo(g.y, 10);
    expect(g.x * 2 + g.width).toBeCloseTo(512, 10);
  });

  it('45% (o clamp do slider) ainda cabe no canvas', () => {
    const g = marginGeometry(512, 0.45);
    expect(g.x * 2 + g.width).toBeCloseTo(512, 10);
    expect(g.width).toBeGreaterThan(0);
  });

  it('margin negativa e absurda sao clampeadas, nunca invertem a guia', () => {
    // `usable = size × (1 - margin)` com margin negativa daria `usable > canvas` e a
    // guia sairia do canvas — pior que nao desenhar.
    expect(marginGeometry(512, -1).width).toBeCloseTo(512, 10);
    expect(marginGeometry(512, 99).width).toBeCloseTo(512 * 0.55, 10);
    expect(marginGeometry(512, Number.NaN).width).toBeCloseTo(512, 10);
  });

  it('canvas de tamanho invalido nao produz geometria de tamanho zero', () => {
    const g = marginGeometry(0, 0);
    expect(g.width).toBeGreaterThan(0);
    expect(g.x).toBeGreaterThanOrEqual(0);
  });

  /**
   * A amarra: a area da mascara e a mesma que `fitAssetSize` usa para a arte.
   *
   * Nao e um teste de valores hard-coded: recalcula pelo caminho de verdade e compara.
   * Se alguem mudar `fitAssetSize`, este falha — e a falha e o ponto.
   */
  it('a area coincide com o que fitAssetSize reserva para a arte', () => {
    for (const margin of [0, 0.1, 0.2, 0.3, 0.45]) {
      for (const size of [256, 512, 1024]) {
        const g = marginGeometry(size, margin);
        const { width } = fitAssetSize(1000, 1000, size, margin);
        // `fitAssetSize` tem um piso (`MIN_LONG_SIDE`); acima dele, o lado maior da
        // arte deve ser exatamente a area da mascara.
        expect(width).toBeCloseTo(g.width, 0);
      }
    }
  });
});

describe('marginDash', () => {
  it('escala com o tamanho da area, para nao virar solido nem riscar demais', () => {
    const pequeno = marginDash(32, 2);
    const grande = marginDash(1024, 2);
    const onDe = (d: string) => Number(d.split(' ')[0]);
    expect(onDe(grande)).toBeGreaterThan(onDe(pequeno));
  });

  it('nunca devolve zero — um dash de 0 e um tracejado invisivel', () => {
    expect(onMin(marginDash(1, 1))).toBeGreaterThanOrEqual(2);
    expect(onMin(marginDash(8, 1))).toBeGreaterThanOrEqual(2);
  });

  it('o vao e menor que o tracejado, para o padrao parecer tracejado e nao pontilhado', () => {
    const [on, off] = marginDash(512, 2).split(' ').map(Number);
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThan(on);
  });
});

const onMin = (d: string): number => Number(d.split(' ')[0]);

describe('isMarginGuideVisible', () => {
  it('esconde a guia quando ela deixa de se ler como retangulo', () => {
    expect(isMarginGuideVisible(7)).toBe(false);
    expect(isMarginGuideVisible(8)).toBe(true);
    expect(isMarginGuideVisible(409)).toBe(true);
  });

  it('a guia continua visivel com a margem no maximo', () => {
    // 55% de 512 = 281px: com a margem em 45% a guia ainda tem de aparecer, ou o
    // controle pareceria quebrado no fim do curso.
    expect(isMarginGuideVisible(marginGeometry(512, 0.45).width)).toBe(true);
  });
});