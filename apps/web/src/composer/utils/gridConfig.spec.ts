import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIVISIONS,
  MAX_DIVISIONS,
  MIN_DIVISIONS,
  clampDivisions,
  gridBackgroundSize
} from './gridConfig';

/**
 * Testes da divisão do grid.
 *
 * O teste que importa é o das **cabeças fechadas**: `100 / 32 = 3.125`, e uma
 * porcentagem arredondada para duas casas daria `3.13` — 32 linhas dando 100,16%, com a
 * última sobrando do canto. Ninguém nota olhando; todo mundo nota quando o grid parece
 * torto.
 */
describe('clampDivisions', () => {
  it('mantém o que está no meio da faixa', () => {
    expect(clampDivisions(8)).toBe(8);
    expect(clampDivisions(2)).toBe(2);
    expect(clampDivisions(32)).toBe(32);
  });

  it('arredonda para inteiro — fração deixa a última linha mais larga', () => {
    expect(clampDivisions(8.4)).toBe(8);
    expect(clampDivisions(8.6)).toBe(9);
  });

  it('trava na faixa: uma divisão não é grid, 33 não se distingue', () => {
    expect(clampDivisions(1)).toBe(MIN_DIVISIONS);
    expect(clampDivisions(0)).toBe(MIN_DIVISIONS);
    expect(clampDivisions(-5)).toBe(MIN_DIVISIONS);
    expect(clampDivisions(99)).toBe(MAX_DIVISIONS);
  });

  it('uma divisão vira o minimo, e o minimo e legivel', () => {
    // `clampDivisions(1)` = 2, e nao 1: uma "divisão" não desenha grade nenhuma. E
    // `MIN_DIVISIONS` tem de ser o que o clamp devolve, senão o piso e o valor saem
    // diferentes e o slider mostra um numero que o grid nao usa.
    expect(clampDivisions(1)).toBe(2);
    expect(MIN_DIVISIONS).toBe(2);
    expect(gridBackgroundSize(1, 1)).toBe('50% 50%');
  });

  it('entrada invalida cai no padrao, e nao em NaN no style', () => {
    // Um `NaN` no `background-size` faz o browser ignorar a declaracao — o grid
    // simplesmente some, sem erro nenhum.
    expect(clampDivisions(Number.NaN)).toBe(DEFAULT_DIVISIONS);
    expect(clampDivisions('abc')).toBe(DEFAULT_DIVISIONS);
    expect(clampDivisions(null)).toBe(DEFAULT_DIVISIONS);
    expect(clampDivisions(undefined)).toBe(DEFAULT_DIVISIONS);
  });

  it('aceita string numerica, porque o NumberField entrega string', () => {
    expect(clampDivisions('12')).toBe(12);
    expect(clampDivisions(' 12 ')).toBe(12);
  });
});

describe('gridBackgroundSize', () => {
  it('o padrao reproduz o que o CSS fixo fazia', () => {
    // `background-size: 12.5% 12.5%` eram 8 divisões. Este teste amarra o padrao novo ao
    // valor antigo, para a troca nao mudar o grid de quem ja se acostumou.
    expect(gridBackgroundSize(DEFAULT_DIVISIONS, DEFAULT_DIVISIONS)).toBe('12.5% 12.5%');
  });

  it('eixos independentes', () => {
    expect(gridBackgroundSize(2, 8)).toBe('50% 12.5%');
    expect(gridBackgroundSize(8, 2)).toBe('12.5% 50%');
  });

  /**
   * As cabeças fecham no máximo.
   *
   * 32 divisões é `3.125%` por célula. Arredondado a duas casas seria `3.13%`, e 32 ×
   * 3.13 = 100,16%: a última linha passaria do canto. Três casas fecham.
   */
  it('as cabeças fecham em 32 divisoes', () => {
    const size = gridBackgroundSize(32, 32);
    const [c] = size.split(' ');
    expect(c).toBe('3.125%');
    expect(MAX_DIVISIONS * Number(c.replace('%', ''))).toBeCloseTo(100, 6);
  });

  /**
   * A soma fecha dentro de 0,01% — e esta e a tolerancia **honesta**.
   *
   * `100 / 3` nao fecha em nenhuma casa decimal: `33.333333 × 3 = 99.999999`. Um
   * `toBeCloseTo(100, 6)` falha para sempre, e um teste que pede o impossivel é um
   * teste que sera apagado no primeiro commit em que atrapalha.
   *
   * 0,01% de um canvas de 1024 sao 0,1px — duas ordens de grandeza abaixo de uma linha
   * de 1px. E o teste ainda pega o que importa: se `percent` voltar a truncar, o erro
   * salta para centésimos de por cento e falha aqui.
   */
  it('as cabeças fecham dentro de 0,01% em toda a faixa', () => {
    for (let n = MIN_DIVISIONS; n <= MAX_DIVISIONS; n++) {
      const [c, r] = gridBackgroundSize(n, n).split(' ');
      expect(Math.abs(n * Number(c.replace('%', '')) - 100)).toBeLessThan(0.01);
      expect(Math.abs(n * Number(r.replace('%', '')) - 100)).toBeLessThan(0.01);
    }
  });

  it('truncar as casas faz o teste acima falhar — a tolerancia nao e folga', () => {
    // Se `percent` voltar a `toFixed(3)`, 24 divisões fecham em 100,008% e este falha.
    const truncado = Number((100 / 24).toFixed(3));
    const pior = [3, 15, 24, 28, 31].some((n) => Math.abs(n * Number((100 / n).toFixed(3)) - 100) >= 0.01);
    expect(Math.abs(24 * truncado - 100)).toBeGreaterThanOrEqual(0.005);
    expect(pior).toBe(true);
  });

  it('divisao invalida de um eixo nao contamina o outro', () => {
    expect(gridBackgroundSize(Number.NaN, 4)).toBe('12.5% 25%');
  });
});