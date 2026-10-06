import { describe, expect, it } from 'vitest';
import {
  ANDROID_INSET_FRACTION,
  ANDROID_SAFE_FRACTION,
  IOS_SQUIRCLE_FRACTION,
  KEYLINE_GEOMETRY,
  maskRadiusPx,
  safeDiameterPx,
  defaultPartsFor,
  safeInsetPx,
  suggestedPartsFor
} from './keylineGeometry';

/**
 * Testes da geometria da keyline.
 *
 * ## O que este arquivo prova, e o que ele ja errou
 *
 * O dono viu que "apenas dois presets sao verdadeiramente diferentes. O iOS e os outros
 * (que parecem ser iguais)". Aqui `iOS` e `Android` tem partes e numeros diferentes, e o
 * numero do Android esta amarrado ao do export.
 *
 * A primeira versao tratou `0.2237` (raio da superellipse do iOS) e `66/108` (zona do
 * Android) como **a mesma medida** — "fracao de zona". O resultado foi que a comparacao
 * "Android e mais restritivo" saiu **invertida**, porque 0,61 > 0,22. A primeira versao
 * deste arquivo falhou nesse teste, e o **teste estava certo**: duas medidas diferentes
 * nao podem ser comparadas como se fossem uma.
 *
 * ## O teste de ancora
 *
 * `ANDROID_SAFE_FRACTION` tem de ser `66 / 108`, o mesmo do preset `android`. Se o preset
 * mudar e a keyline nao, a guia descreve uma plataforma que nao e a que sera exportada — e
 * ninguem percebe, porque as duas constantes continuam "sendo 0,61".
 */
describe('as medidas, e sao medidas diferentes', () => {
  it('Android: o diametro da zona e 66/108', () => {
    expect(ANDROID_SAFE_FRACTION).toBe(66 / 108);
    expect(ANDROID_SAFE_FRACTION).toBeCloseTo(0.6111, 4);
  });

  it('Android: o recuo de cada borda e (108-66)/2', () => {
    expect(ANDROID_INSET_FRACTION).toBe(21 / 108);
    expect(ANDROID_INSET_FRACTION).toBeCloseTo(0.19444, 5);
  });

  it('zona e recuo sao compliments, e somam a 1', () => {
    expect(ANDROID_INSET_FRACTION * 2 + ANDROID_SAFE_FRACTION).toBeCloseTo(1, 10);
  });

  it('iOS: 0,2237 e raio de canto, e nao zona', () => {
    expect(IOS_SQUIRCLE_FRACTION).toBeCloseTo(0.2237, 4);
    // E o iOS **nao tem** inset: e o que a tabela registra.
    expect(KEYLINE_GEOMETRY.ios.insetFraction).toBeNull();
  });
});

describe('KEYLINE_GEOMETRY', () => {
  it('cada plataforma tem uma mascara declarada', () => {
    for (const [nome, g] of Object.entries(KEYLINE_GEOMETRY)) {
      expect(g.mask.length).toBeGreaterThan(0);
      expect(nome.length).toBeGreaterThan(0);
    }
  });

  it('iOS e Android tem mascaras **diferentes**', () => {
    expect(KEYLINE_GEOMETRY.ios.mask).not.toBe(KEYLINE_GEOMETRY.android.mask);
  });

  it('so o Android tem zona medida neste repositorio', () => {
    const comZona = Object.entries(KEYLINE_GEOMETRY).filter(([, g]) => g.insetFraction !== null);
    expect(comZona.map(([nome]) => nome)).toEqual(['android']);
  });
});

describe('safeInsetPx / safeDiameterPx', () => {
  it('Android em 512: recuo de 99,56px, diametro de 312,9px', () => {
    expect(safeInsetPx('android', 512)!).toBeCloseTo(512 * (21 / 108), 4);
    expect(safeInsetPx('android', 512)!).toBeCloseTo(99.56, 2);
    expect(safeDiameterPx('android', 512)!).toBeCloseTo(312.89, 2);
  });

  it('inset + diametro + 2×inset fecham o canvas', () => {
    for (const size of [256, 512, 1024]) {
      const i = safeInsetPx('android', size)!;
      const d = safeDiameterPx('android', size)!;
      expect(i + d + i).toBeCloseTo(size, 6);
    }
  });

  it('escala com o canvas — 1024 dobra', () => {
    expect(safeInsetPx('android', 1024)).toBeCloseTo(safeInsetPx('android', 512)! * 2, 6);
  });

  it('plataformas sem zona devolvem null, e nao 0', () => {
    // `0` seria uma guia degenerada no canto; `null` e "nao tem", que e o que o overlay
    // precisa saber para nao desenhar nada.
    for (const p of ['ios', 'generic', 'circle', 'square'] as const) {
      expect(safeInsetPx(p, 512)).toBeNull();
      expect(safeDiameterPx(p, 512)).toBeNull();
    }
  });
});

describe('suggestedPartsFor', () => {
  it('Android recomenda circulo inscrito — e a zona dele e circular', () => {
    expect(suggestedPartsFor('android')).toContain('circle');
  });

  it('iOS nao recomenda nem circulo inscrito, nem zona', () => {
    // A superellipse do iOS ja e a mascara (o frame), entao uma segunda caixa seria
    // repetir o mesmo desenho. E o iOS nao tem zona medida neste repositorio.
    expect(suggestedPartsFor('ios')).toEqual(['frame']);
    expect(suggestedPartsFor('ios')).not.toContain('circle');
    expect(suggestedPartsFor('ios')).not.toContain('squircle');
  });

  it('circle so recomenda o circulo: frame e inscrito sao a mesma linha', () => {
    // `frame` com raio = metade do lado e `circle` desenham os mesmos pixels. Dois
    // switches para a mesma guia e um switch que parece outro.
    expect(suggestedPartsFor('circle')).toEqual(['circle']);
  });

  it('generic nao recomenda zona — nao ha numero para ela', () => {
    expect(suggestedPartsFor('generic')).not.toContain('squircle');
  });

  it('generic recomenda a grade: e a unica referencia quando nada e garantido', () => {
    expect(suggestedPartsFor('generic')).toContain('grid');
  });

  it('iOS e Android **nao** desenham as mesmas partes', () => {
    // O teste que responde a pergunta do dono, com a resposta em codigo.
    expect(suggestedPartsFor('ios')).not.toEqual(suggestedPartsFor('android'));
  });

  it('toda parte recomendada existe no catalogo', () => {
    const validas = new Set(['frame', 'grid', 'circle', 'squircle', 'safe-area']);
    for (const p of ['ios', 'android', 'generic', 'circle', 'square'] as const) {
      for (const parte of suggestedPartsFor(p)) {
        expect(validas.has(parte)).toBe(true);
      }
    }
  });

  it('toda plataforma recomenda o que desenha a borda ou o limite dela', () => {
    // Nao `frame` para todas: quando a mascara ja e um circulo, \`circle\` desenha a mesma
    // linha. A regra e "alguma coisa que acerte a borda", nao "o frame sempre".
    for (const p of ['ios', 'android', 'generic', 'circle', 'square'] as const) {
      const parts = suggestedPartsFor(p);
      expect(parts.includes('frame') || parts.includes('circle')).toBe(true);
    }
  });
});

describe('maskRadiusPx', () => {
  it('iOS usa a superellipse de 22,37%', () => {
    expect(maskRadiusPx('ios', 512)).toBeCloseTo(512 * 0.2237, 4);
  });

  it('circle e Android usam metade do lado', () => {
    expect(maskRadiusPx('circle', 512)).toBe(256);
    expect(maskRadiusPx('android', 512)).toBe(256);
  });

  it('square usa 4px', () => {
    expect(maskRadiusPx('square', 512)).toBe(4);
  });

  it('iOS e circle nao compartilham raio — a mascara e da plataforma', () => {
    expect(maskRadiusPx('ios', 512)).not.toBe(maskRadiusPx('circle', 512));
  });
});

describe('defaultPartsFor — o que o switch liga', () => {
  it('no iOS liga a safe area, porque e ela que mostra onde o sistema corta', () => {
    // A `safe-area` vem de `canvas.safeArea` (do documento), e por isso nao aparece em
    // `suggestedPartsFor`. Mas no iOS ela e a guia que mais importa: a superellipse e a
    // borda, e o tracejado e o limite seguro.
    expect(defaultPartsFor('ios')).toEqual(['frame', 'safe-area']);
  });

  it('fora do iOS, defaultPartsFor e suggestedPartsFor', () => {
    for (const p of ['android', 'generic', 'circle', 'square'] as const) {
      expect(defaultPartsFor(p)).toEqual(suggestedPartsFor(p));
    }
  });

  it('a safe area so entra por padrao no iOS — nos outros a mascara ja orienta', () => {
    for (const p of ['android', 'generic', 'circle', 'square'] as const) {
      expect(defaultPartsFor(p)).not.toContain('safe-area');
    }
  });

  it('Android e iOS ligam conjuntos **diferentes**', () => {
    expect(defaultPartsFor('ios')).not.toEqual(defaultPartsFor('android'));
  });
});
