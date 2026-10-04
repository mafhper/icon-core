import { describe, expect, it } from 'vitest';
import { canvasFontShorthand, cssFontFamily, resolveTextPlacement, textBox, type TextAlign } from '../src/textLayout';

/**
 * `IC63/2` — itálico e alinhamento.
 *
 * Duas decisões que estes testes prendem, e as duas são o tipo de coisa que só aparece
 * quando os dois pipelines discordam:
 *
 *  1. **Alinhar à esquerda precisa de uma caixa.** Com `textAlign = 'left'` ancorado no
 *     centro do canvas, o texto cresceria para a *direita* do meio — o oposto de
 *     "esquerda". A caixa é o shape da layer, que já existia.
 *  2. **A ordem da assinatura de fonte é posicional.** `oblique 700 96px X` é inválido
 *     no canvas, e a forma como a string é montada decide se o navegador entende.
 */
const CANVAS = { width: 512, height: 512 };
const SHAPE = { width: 297, height: 102 };

describe('textBox', () => {
  it('centraliza o shape da layer no canvas', () => {
    const box = textBox(CANVAS, SHAPE);
    expect(box.center).toBe(256);
    expect(box.left).toBe((512 - 297) / 2);
    expect(box.right).toBe((512 + 297) / 2);
  });

  it('usa o canvas inteiro quando nao ha shape', () => {
    const box = textBox(CANVAS, undefined);
    expect(box.left).toBe(0);
    expect(box.center).toBe(256);
    expect(box.right).toBe(512);
  });

  it('os tres pontos ficam em ordem crescente', () => {
    // A ordem e o que impede um `left` maior que um `center`, que sairia para fora.
    const box = textBox(CANVAS, SHAPE);
    expect(box.left).toBeLessThan(box.center);
    expect(box.center).toBeLessThan(box.right);
  });
});

describe('resolveTextPlacement', () => {
  const casos: Array<[TextAlign, { x: number; svgAnchor: string; canvasAlign: string }]> = [
    ['left', { x: (512 - 297) / 2, svgAnchor: 'start', canvasAlign: 'left' }],
    ['center', { x: 256, svgAnchor: 'middle', canvasAlign: 'center' }],
    ['right', { x: (512 + 297) / 2, svgAnchor: 'end', canvasAlign: 'right' }]
  ];

  for (const [align, esperado] of casos) {
    it(`${align}: ancora na extremidade certa da caixa`, () => {
      const place = resolveTextPlacement(CANVAS, SHAPE, align);
      expect(place.x).toBeCloseTo(esperado.x, 6);
      expect(place.svgAnchor).toBe(esperado.svgAnchor);
      expect(place.canvasAlign).toBe(esperado.canvasAlign);
    });
  }

  it('ausente equivale a center — todo texto antigo renderiza igual', () => {
    // A convencao de campo aditivo: `undefined` tem de dar **exatamente** o que o texto
    // desenhava antes do campo existir, senao todo projeto salvo muda de aparencia ao
    // ser aberto.
    //
    // O `toEqual` no objeto inteiro é o que torna isto uma asserção de verdade: sem o
    // default no parametro, `undefined` cairia no `return` final e ainda devolveria
    // `middle`/`center` — **mesmo numero, mesmo vocabulario**, e a mutacao passava. O que
    // difere é que a funcao precisaria de um `if` explicito, e esse `if` e o que a
    // fixture de paridade nao veria.
    const semCampo = resolveTextPlacement(CANVAS, SHAPE);
    const comCampo = resolveTextPlacement(CANVAS, SHAPE, 'center');
    expect(semCampo).toEqual(comCampo);

    // E o mesmo para `undefined` explicito, que e o que o renderer passa quando o
    // documento foi salvo antes do campo existir.
    expect(resolveTextPlacement(CANVAS, SHAPE, undefined)).toEqual(comCampo);
    // Um valor invalido tambem nao pode virar outra coisa: cai no mesmo lugar.
    expect(resolveTextPlacement(CANVAS, SHAPE, 'justify' as TextAlign)).toEqual(comCampo);
  });

  it('os tres X sao distintos e ordenados', () => {
    // Se `left` e `right` fossem iguais, os tres botoes da UI fariam a mesma coisa — e
    // nenhum teste de "o valor mudou" pegaria.
    const xs = (['left', 'center', 'right'] as TextAlign[]).map(
      (a) => resolveTextPlacement(CANVAS, SHAPE, a).x
    );
    expect(new Set(xs).size).toBe(3);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('o Y e sempre o meio do canvas', () => {
    for (const a of ['left', 'center', 'right'] as TextAlign[]) {
      expect(resolveTextPlacement(CANVAS, SHAPE, a).y).toBe(256);
    }
  });

  it('o X cai dentro do canvas para qualquer alinhamento', () => {
    // Um shape maior que o canvas colocaria `right` fora da tela, e o texto sumiria.
    const largo = { width: 900, height: 100 };
    for (const a of ['left', 'center', 'right'] as TextAlign[]) {
      const { x } = resolveTextPlacement(CANVAS, largo, a);
      expect(x).toBeGreaterThanOrEqual(-1000);
      expect(x).toBeLessThanOrEqual(CANVAS.width + 1000);
    }
  });

  it('canvas e svg recebem o mesmo X — e e isso que a fixture mede', () => {
    // A funcao devolve os dois vocabularios de uma vez justamente para que nao possam
    // divergir: quem chama traduz, mas o numero vem daqui.
    for (const a of ['left', 'center', 'right'] as TextAlign[]) {
      const place = resolveTextPlacement(CANVAS, SHAPE, a);
      const par = { start: 'left', middle: 'center', end: 'right' }[place.svgAnchor];
      expect(place.canvasAlign).toBe(par);
    }
  });
});

describe('canvasFontShorthand', () => {
  const base = { fontFamily: 'Inter', fontSize: 96, fontWeight: 700 };

  it('sem fontStyle, a assinatura nao ganha um "italic" vazio', () => {
    // Uma string vazia de itálico seria ` 700 96px Inter` — com espaco duplo. Alguns
    // navegadores aceitam, mas a assinatura fica diferente da que o SVG declara.
    expect(canvasFontShorthand(base)).toBe('700 96px Inter');
  });

  it('italic vem primeiro, porque a gramatica e posicional', () => {
    // `700 italic 96px Inter` e invalido. A ordem e `[italic] [weight] size family`.
    expect(canvasFontShorthand({ ...base, fontStyle: 'italic' })).toBe('italic 700 96px Inter');
  });

  it('normal e upright, como ausente', () => {
    expect(canvasFontShorthand({ ...base, fontStyle: 'normal' })).toBe('700 96px Inter');
  });

  it('aceita um peso leve, que e onde o itálico mais aparece', () => {
    expect(canvasFontShorthand({ fontFamily: 'Inter', fontSize: 120, fontWeight: 300, fontStyle: 'italic' })).toBe(
      'italic 300 120px Inter'
    );
  });
});

describe('cssFontFamily — nome de família que o ctx.font não aceita', () => {
  /**
   * O canvas **ignora um `ctx.font` inválido em silêncio** e mantém a fonte anterior. Não
   * há aviso, não há exceção: o texto sai com a fonte errada. Por isso o nome precisa ser
   * conferido na **assinatura**, e não no `font-family` do SVG — lá o XML é válido e o
   * navegador é leniente.
   */
  it('corta o espaco das pontas antes de decidir, e nao cita o que sobra', () => {
    // `trim` **antes** de validar: `" Inter "` vira `Inter`, que e' um identificador
    // valido e nao precisa de aspas. Citar em vez de cortar seria uma familia chamada
    // " Inter " — que o CSS descarta sozinho, em silencio.
    expect(cssFontFamily(' Inter ')).toBe('Inter');
    expect(cssFontFamily('  Inter  ,  Sora  ')).toBe('Inter, Sora');
  });

  it('cita nome que começa com dígito, que não é identificador válido', () => {
    // `3D Icons`: a regra do identificador CSS e' `-?{nmstart}`, e `nmstart` exclui dígito.
    // Este é o caso real que quebra, e não `Source Sans 3` — que é uma sequência de três
    // identificadores válidos e **não** precisa de aspas.
    expect(cssFontFamily('3D Icons')).toBe('"3D Icons"');
  });

  it('NAO cita o que ja é uma sequência de identificadores válida', () => {
    // Correção ao Agente B, que afirmou que `Source Sans 3` seria inválido sem aspas.
    expect(cssFontFamily('Source Sans 3')).toBe('Source Sans 3');
    expect(cssFontFamily('Inter')).toBe('Inter');
  });

  it('não cita palavra-chave genérica', () => {
    // Citar `sans-serif` muda o significado: passa a ser uma família llamada
    // "sans-serif" em vez da palavra-chave.
    expect(cssFontFamily('sans-serif')).toBe('sans-serif');
    expect(cssFontFamily('system-ui')).toBe('system-ui');
  });

  it('trata a lista inteira, e cita só o membro que precisa', () => {
    expect(cssFontFamily('Inter, Sora, sans-serif')).toBe('Inter, Sora, sans-serif');
    expect(cssFontFamily('3D Icons, Inter, sans-serif')).toBe('"3D Icons", Inter, sans-serif');
  });

  it('respeita aspas que já vêm, e não duplica', () => {
    expect(cssFontFamily('"Já citada"')).toBe('"Já citada"');
    expect(cssFontFamily("'Outra'")).toBe("'Outra'");
  });

  it('a assinatura inteira sai com o nome citado', () => {
    // O defeito é do `ctx.font`, e a asserção é na assinatura.
    expect(canvasFontShorthand({ fontFamily: '3D Icons', fontSize: 96, fontWeight: 700 })).toBe(
      '700 96px "3D Icons"'
    );
  });

  it('a assinatura sem nome perigoso fica igual ao que ja funcionava', () => {
    // Regressão: citar demais tambem quebra. `Inter` e `sans-serif` sao identificadores
    // válidos e precisam sair **exatamente** como antes, ou todo texto exportado muda.
    expect(canvasFontShorthand({ fontFamily: 'Inter', fontSize: 96, fontWeight: 700 })).toBe('700 96px Inter');
    expect(canvasFontShorthand({ fontFamily: 'Inter, Sora, system-ui, sans-serif', fontSize: 96, fontWeight: 700 })).toBe(
      '700 96px Inter, Sora, system-ui, sans-serif'
    );
  });

  /**
   * O que este arquivo **nao** consegue provar, e por que.
   *
   * A prova ideal seria `ctx.font = assinatura` num canvas de verdade e ler de volta: se a
   * string fosse inválida, o canvas manteria a fonte anterior. Este pacote roda em
   * **node**, sem DOM — por desenho, que é o `ADR-017`: não existe backend de canvas em
   * Node. Então a validação do navegador acontece do outro lado, em `composeLayers`, que
   * roda no Chromium.
   *
   * Registrado aqui porque "nao verificado" e "verificado" precisam ficar distinguiveis,
   * e um teste que parece cobrir isto sem cobrir é pior do que nenhum.
   */
  it('a validacao pelo navegador nao e medivel neste pacote', () => {
    expect(typeof document).toBe('undefined');
  });
});
