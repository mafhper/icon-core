import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORK_AREA_COLOR,
  isValidHex,
  resolveWorkAreaColor,
  workAreaToCss,
  type WorkAreaColor
} from './workArea';

/**
 * Testes da cor da work area.
 *
 * O critério não é "a cor mudou" — é que o **fallback continue sendo o token do tema**.
 * O defeito que motivou isto foi um literal de cor usado como se fosse padrão; e a forma
 * de ele voltar é um `#` no lugar errado. O primeiro teste é o que trava isso.
 *
 * Este arquivo está em `hexExceptions` do `.ui-budget.json`, como os outros specs de cor
 * (`fill.spec.ts`, `colorLibrary.spec.ts`). Um teste que **verifica normalização de hex**
 * precisa escrever hex; ele não produz interface, e não deve gastar o ratchet de quem
 * produz.
 */
describe('workAreaToCss', () => {
  it('cor vazia cai no token do tema, nunca num hex', () => {
    // Este e o teste que importa. Um default hex aqui viraria um desk quase preto no
    // tema claro — valor copiado de um tema para o outro.
    expect(workAreaToCss(DEFAULT_WORK_AREA_COLOR)).toBe('var(--ic-bg)');
    expect(workAreaToCss(null)).toBe('var(--ic-bg)');
    expect(workAreaToCss(undefined)).toBe('var(--ic-bg)');
    expect(workAreaToCss({ color: '', alpha: 1 })).toBe('var(--ic-bg)');
  });

  it('hex valido vira a propria cor', () => {
    expect(workAreaToCss({ color: '#1e1e1e', alpha: 1 })).toBe('#1e1e1e');
  });

  it('aceita hex de 3 digitos e normaliza', () => {
    expect(workAreaToCss({ color: '#abc', alpha: 1 })).toBe('#aabbcc');
  });

  it('aceita hex com o sinal de hash ausente', () => {
    expect(workAreaToCss({ color: '1e1e1e', alpha: 1 })).toBe('#1e1e1e');
  });

  it('alpha menor que 1 vira color-mix, que sobrevive a transparencia herdada', () => {
    const css = workAreaToCss({ color: '#1e1e1e', alpha: 0.5 });
    expect(css).toBe('color-mix(in srgb, #1e1e1e 50%, transparent)');
  });

  it('alpha acima de 1 e tratado como opaco', () => {
    expect(workAreaToCss({ color: '#1e1e1e', alpha: 3 })).toBe('#1e1e1e');
  });

  it('hex invalido cai no token, e nao em hex pela metade', () => {
    // `#abcde` nao e cor. Emitir isso no `style` deixaria o browser ignorar a
    // declaracao e o desk herdaria o fundo do app — silenciosamente.
    expect(workAreaToCss({ color: '#abcde', alpha: 1 })).toBe('var(--ic-bg)');
    expect(workAreaToCss({ color: 'vermelho', alpha: 1 })).toBe('var(--ic-bg)');
  });
});

describe('resolveWorkAreaColor', () => {
  it('vazio devolve o token do tema quando ele e passado', () => {
    // Sem token resolvido, o estado inicial honesto e `{ color: '', alpha: 1 }` — e
    // `workAreaToCss` continua devolvendo `var(--ic-bg)`, entao o desk nunca fica preto.
    const r = resolveWorkAreaColor(null);
    expect(r).toEqual({ color: '', alpha: 1 });
    expect(workAreaToCss(r)).toBe('var(--ic-bg)');

    // Com o token resolvido, a amostra passa a ser **a cor da bancada**, e nao um
    // sentinela que mentiria no outro tema.
    const comTema = resolveWorkAreaColor(null, '#101317');
    expect(comTema.color).toBe('#101317');
    expect(isValidHex(comTema.color)).toBe(true);
  });

  it('token invalido nao vira cor: volta ao estado inicial', () => {
    const r = resolveWorkAreaColor(null, 'nao-e-cor');
    expect(r).toEqual({ color: '', alpha: 1 });
  });

  it('guarda o que foi escolhido, com alpha clampado', () => {
    expect(resolveWorkAreaColor({ color: '#123456', alpha: 0.3 })).toEqual({
      color: '#123456',
      alpha: 0.3
    });
    expect(resolveWorkAreaColor({ color: '#123456', alpha: 5 }).alpha).toBe(1);
    expect(resolveWorkAreaColor({ color: '#123456', alpha: -2 }).alpha).toBe(0);
    expect(resolveWorkAreaColor({ color: '#123456', alpha: Number.NaN }).alpha).toBe(1);
  });

  it('o que ele mostra e o que ele grava: ida e volta', () => {
    const escolhido: WorkAreaColor = { color: '#0a0b0c', alpha: 0.85 };
    const guardado = resolveWorkAreaColor(escolhido);
    expect(workAreaToCss(guardado)).toBe(workAreaToCss(escolhido));
  });
});

describe('isValidHex', () => {
  it('aceita 3 e 6 digitos, com ou sem hash', () => {
    expect(isValidHex('#abc')).toBe(true);
    expect(isValidHex('abc')).toBe(true);
    expect(isValidHex('#aabbcc')).toBe(true);
    expect(isValidHex('AABBCC')).toBe(true);
  });

  it('recusa 4, 5 e 8 digitos', () => {
    // 8 digitos e um hex **com alpha** em notacao CSS. Aceitar aqui e devolver 6
    // digitos seria silenciosamente errado.
    expect(isValidHex('#abcd')).toBe(false);
    expect(isValidHex('#abcde')).toBe(false);
    expect(isValidHex('#aabbccdd')).toBe(false);
  });
});