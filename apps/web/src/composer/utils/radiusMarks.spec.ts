import { describe, expect, it } from 'vitest';
import { RADIUS_MARKS, markForRadius, radiusMarkValue } from './radiusMarks';

/**
 * Testes das marcas do frame radius.
 *
 * O teste que realmente importa é o **primeiro**: ele amarra a lista de marcas ao
 * `defaultMaskRadius`, que é a fonte única. Sem ele, uma plataforma nova pode entrar
 * com uma marca que aponta para um número que o frame nunca usa — e ninguém descobre
 * até alguém clicar na marca e o ícone não mudar.
 */
describe('marcas do frame radius', () => {
  it('cada marca aponta para o padrao real da forma', () => {
    expect(radiusMarkValue('square', 512, 256)).toBe(4);
    expect(radiusMarkValue('rounded-rectangle', 512, 256)).toBe(24);
    expect(radiusMarkValue('circle', 512, 256)).toBe(256);
    expect(radiusMarkValue('squircle', 512, 256)).toBe(115);
  });

  it('as marcas escalam com o canvas', () => {
    expect(radiusMarkValue('rounded-rectangle', 1024, 512)).toBe(24); // px fixo
    expect(radiusMarkValue('circle', 1024, 512)).toBe(512); // metade do lado
    expect(radiusMarkValue('squircle', 1024, 512)).toBe(229);
  });

  it('marca fora do alcance do slider nao e clicavel', () => {
    // Circulo em 1024 tem raio 512; com `max` menor, a marca some em vez de empurrar
    // o valor para um numero que o frame nunca usa.
    expect(radiusMarkValue('circle', 1024, 300)).toBeNull();
    expect(radiusMarkValue('square', 1024, 300)).toBe(4);
  });

  it('circulo nunca cai fora do alcance, porque e exatamente o max', () => {
    // `size/2` **e** o `max` do slider (ver `LayerInspector`). Se isto quebrar, a marca
    // do circulo — a mais importante — some do slider sem o dono perceber.
    const size = 512;
    expect(radiusMarkValue('circle', size, Math.round(size / 2))).toBe(Math.round(size / 2));
  });

  it('reconhece a marca do raio atual, e nada quando e valor livre', () => {
    expect(markForRadius(256, 512)?.shape).toBe('circle');
    expect(markForRadius(24, 512)?.shape).toBe('rounded-rectangle');
    // 100 nao e padrao de forma nenhuma.
    expect(markForRadius(100, 512)).toBeNull();
  });

  it('toda marca tem glifo e descricao: nenhuma marca e um glifo mudo', () => {
    // Um `aria-label` que so repete o glifo nao diz o que a marca faz.
    for (const mark of RADIUS_MARKS) {
      expect(mark.label.length).toBeGreaterThan(0);
      expect(mark.description.length).toBeGreaterThan(0);
    }
  });

  it('as marcas cobrem todas as formas que a plataforma pode assumir', () => {
    const formas = new Set(RADIUS_MARKS.map((m) => m.shape));
    for (const forma of ['square', 'rounded-rectangle', 'circle', 'squircle'] as const) {
      expect(formas.has(forma)).toBe(true);
    }
  });

  it('os glifos sao distintos: dois botoes com o mesmo glifo nao sao dois botoes', () => {
    const glifos = RADIUS_MARKS.map((m) => m.label);
    expect(new Set(glifos).size).toBe(glifos.length);
  });
});