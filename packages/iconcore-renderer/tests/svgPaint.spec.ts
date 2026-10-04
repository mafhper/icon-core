import { describe, expect, it } from 'vitest';
import {
  applySvgPaintOverrides,
  extractSvgPaintColors,
  normalizeSvgPaint,
  pruneSvgPaintOverrides
} from '../src/svgPaint';

/**
 * `IC63/1b` — a cor de um SVG importado.
 *
 * Os casos abaixo não são inventados: cada um reproduz um padrão que a medição dos
 * 1816 SVG do acervo encontrou, e que um parser "óbvio" erra. `black` nomeada 17.414
 * vezes, `fill="none"` em 100% dos arquivos, `style="fill:…"` em 13,5%, `stop-color`
 * em 15%.
 */
describe('normalizeSvgPaint', () => {
  it('normaliza hex curto e longo para a mesma chave', () => {
    expect(normalizeSvgPaint('#ABC')).toBe('#aabbcc');
    expect(normalizeSvgPaint('#aabbcc')).toBe('#aabbcc');
    expect(normalizeSvgPaint('#AABBCC')).toBe('#aabbcc');
  });

  it('ignora o alpha na chave, senao a mesma cor vira duas', () => {
    // `#abcd` e `#abbb` tem o mesmo olho; se o alpha fosse parte da chave seriam dois
    // swatches, e trocar um deixaria o outrovelho.
    expect(normalizeSvgPaint('#abcd')).toBe('#aabbcc');
    expect(normalizeSvgPaint('#aabbccdd')).toBe('#aabbcc');
  });

  it('normaliza cor nomeada — o achado que mais importa no corpus', () => {
    // `black` aparece 17.414 vezes no acervo. Sem esta linha, `black` e `#000000`
    // seriam dois swatches da mesma cor, e o override de um não afetaria o outro.
    expect(normalizeSvgPaint('black')).toBe('#000000');
    expect(normalizeSvgPaint('BLACK')).toBe('#000000');
    expect(normalizeSvgPaint('white')).toBe('#ffffff');
    expect(normalizeSvgPaint('  red  ')).toBe('#ff0000');
  });

  it('normaliza rgb() com e sem espacos', () => {
    expect(normalizeSvgPaint('rgb(255,0,0)')).toBe('#ff0000');
    expect(normalizeSvgPaint('rgb(255 0 0)')).toBe('#ff0000');
    expect(normalizeSvgPaint('rgba(0,0,0,0.5)')).toBe('#000000');
    expect(normalizeSvgPaint('rgb(100%, 0%, 0%)')).toBe('#ff0000');
  });

  it('devolve null para o que parece cor e nao e', () => {
    // `fill="none"` esta em 100% dos arquivos do corpus (o wrapper). Se entrar na
    // lista, o primeiro swatch da lista e "none".
    expect(normalizeSvgPaint('none')).toBeNull();
    expect(normalizeSvgPaint('transparent')).toBeNull();
    // `inherit` e `context-*` resolvem a partir de fora do elemento: uma cor nova seria
    // uma mentira sobre o que o arquivo autorou.
    expect(normalizeSvgPaint('inherit')).toBeNull();
    expect(normalizeSvgPaint('context-fill')).toBeNull();
    expect(normalizeSvgPaint('')).toBeNull();
    // Paint server: reescrever isto por uma cor apaga o gradiente.
    expect(normalizeSvgPaint('url(#grad)')).toBeNull();
    expect(normalizeSvgPaint('url("#a-b")')).toBeNull();
  });

  it('aceita o que o browser resolve, como token opaco', () => {
    // `currentColor` e 0% no corpus do Rune, mas e comum em icones do mundo real. Sem
    // esta linha a cor ficaria travada justamente nos arquivos que a pessoa trouxe de
    // fora — e, mais importante, e o que da carga real aos guards de `none`/`url()`:
    // sem aceitar identificador, eles seriam redundantes com o fallthrough e
    // impossiveis de testar.
    //
    // `currentColor` estava na lista de exclusao na primeira versao, ao lado de
    // `none`. A propria justificativa do codigo dizia o contrario, e o teste aqui
    //exists para manter as duas coisas de acordo.
    expect(normalizeSvgPaint('currentColor')).toBe('currentcolor');
    expect(normalizeSvgPaint('CanvasText')).toBe('canvastext');
    expect(normalizeSvgPaint('rebeccapurple')).toBe('#663399');
  });

  it('repassa funcao de cor que ele nao sabe ler, em vez de inventar hex', () => {
    // `oklch()`, `lab()` e `color()` sao sintaxe de cor valida que este arquivo nao
    // avalia. A alternativa — recusar — deixaria a cor travada em qualquer icone
    // moderno. O browser e a autoridade sobre sintaxe de cor; o override entrega a
    // string que o browser entende.
    expect(normalizeSvgPaint('oklch(0.7 0.1 200)')).toBe('oklch(0.7 0.1 200)');
    expect(normalizeSvgPaint('rgb(a,b,c)')).toBe('rgb(a,b,c)');
  });

  it('devolve null para lixo, em vez de inventar uma cor', () => {
    expect(normalizeSvgPaint('#xyz')).toBeNull();
    expect(normalizeSvgPaint('#12345')).toBeNull();
    expect(normalizeSvgPaint('!important')).toBeNull();
    expect(normalizeSvgPaint('2px')).toBeNull();
    expect(normalizeSvgPaint('0.5')).toBeNull();
  });
});

describe('extractSvgPaintColors', () => {
  it('le fill de atributo — 100% dos arquivos do corpus', () => {
    const cores = extractSvgPaintColors('<svg><path fill="#ffffff" d="M0 0"/></svg>');
    expect(cores).toHaveLength(1);
    expect(cores[0]).toMatchObject({ hex: '#ffffff', count: 1, roles: ['fill'] });
  });

  it('agrupa nomeada e hex da mesma cor em um swatch so', () => {
    const cores = extractSvgPaintColors('<svg><path fill="black"/><path fill="#000"/></svg>');
    expect(cores).toHaveLength(1);
    expect(cores[0].hex).toBe('#000000');
    expect(cores[0].count).toBe(2);
  });

  it('conta stop-color, para gradiente entrar na lista', () => {
    // Empate de contagem resolve por hex, e o desempate e `localeCompare` sobre o hex
    // normalizado: `'#111111' < '#dddddd'`, porque `'1'` (0x31) vem antes de `'d'`
    // (0x64). A primeira versão deste teste esperava o ordem inverso e falhou — o
    // criterio e determinismo, e o criterio escrito e o codigo.
    const cores = extractSvgPaintColors(
      '<svg><defs><linearGradient id="g"><stop stop-color="#dddddd"/><stop stop-color="#111"/></linearGradient></defs></svg>'
    );
    expect(cores.map((c) => c.hex)).toEqual(['#111111', '#dddddd']);
    expect(cores.every((c) => c.roles.includes('stop-color'))).toBe(true);
  });

  it('le fill de style inline — 13,5% dos arquivos', () => {
    const cores = extractSvgPaintColors('<svg><path style="fill:#a4a5a6;stroke:#111;stroke-width:2"/></svg>');
    expect(cores.map((c) => c.hex)).toEqual(['#111111', '#a4a5a6']);
  });

  it('registra os dois papeis quando a mesma cor pinta e contorna', () => {
    const cores = extractSvgPaintColors('<svg><path fill="#123456" stroke="#123456"/></svg>');
    expect(cores[0].roles.sort()).toEqual(['fill', 'stroke']);
  });

  it('ordena por contagem, e a ordem e estavel', () => {
    // Sem ordenacao por contagem o swatch "pula" entre icones: a mesma cor em posicao
    // diferente cada vez que a pessoa abre um arquivo.
    const a = extractSvgPaintColors('<svg><path fill="#111"/><path fill="#eee"/><path fill="#eee"/></svg>');
    const b = extractSvgPaintColors('<svg><path fill="#eee"/><path fill="#eee"/><path fill="#111"/></svg>');
    expect(a.map((c) => c.hex)).toEqual(b.map((c) => c.hex));
    expect(a[0].hex).toBe('#eeeeee');
  });

  it('nao conta fill-rule nem fill-opacity como cor', () => {
    // O erro classico de casar o nome da propriedade sem exigir o `=`. `fill-rule` e
    // `fill-opacity` estao em quase todo SVG de icone.
    const cores = extractSvgPaintColors(
      '<svg><path fill-rule="evenodd" fill-opacity="0.5" clip-rule="evenodd"/></svg>'
    );
    expect(cores).toHaveLength(0);
  });

  it('ignora none e url() — nao sao cores', () => {
    const cores = extractSvgPaintColors(
      '<svg><g fill="none"><path fill="url(#g)"/><path fill="#abc"/></g></svg>'
    );
    expect(cores.map((c) => c.hex)).toEqual(['#aabbcc']);
  });
});

describe('applySvgPaintOverrides', () => {
  it('devolve a entrada intacta sem overrides', () => {
    const markup = '<svg><path fill="#ffffff"/></svg>';
    expect(applySvgPaintOverrides(markup, {})).toBe(markup);
    expect(applySvgPaintOverrides(markup, { '#ffffff': '#ffffff' })).toBe(markup);
  });

  it('reescreve so a cor mapeada, preservando o resto byte a byte', () => {
    const markup = '<svg viewBox="0 0 16 16"><path fill="#ffffff" fill-rule="evenodd" d="M1 2"/></svg>';
    const saida = applySvgPaintOverrides(markup, { '#ffffff': '#000000' });
    expect(saida).toBe('<svg viewBox="0 0 16 16"><path fill="#000000" fill-rule="evenodd" d="M1 2"/></svg>');
  });

  it('encontra a cor mesmo escrita de outra forma', () => {
    // A chave e o hex normalizado; o arquivo pode escrever nomeada ou curto.
    expect(applySvgPaintOverrides('<svg><path fill="black"/></svg>', { '#000000': '#ff0000' })).toContain(
      'fill="#ff0000"'
    );
    expect(applySvgPaintOverrides('<svg><path fill="#FFF"/></svg>', { '#ffffff': '#00ff00' })).toContain(
      'fill="#00ff00"'
    );
  });

  it('reescreve todas as ocorrencias da mesma cor', () => {
    const saida = applySvgPaintOverrides(
      '<svg><path fill="#eee"/><path fill="#eee"/><path fill="#111"/></svg>',
      { '#eeeeee': '#ff0000' }
    );
    expect(saida.match(/#ff0000/g)).toHaveLength(2);
  });

  it('NAO normaliza a cor que nao esta no mapa — a reescrita e minima', () => {
    // O esperado aqui era o oposto, e o codigo esta certo: `#111` fica byte-identico
    // em vez de virar `#111111`. Normalizar o que nao foi pedido reescreveria o
    // arquivo da pessoa em cima de um override que nao pediu isso, e o diff do
    // markup exportado encheria de ruido.
    const saida = applySvgPaintOverrides('<svg><path fill="#eee"/><path fill="#111"/></svg>', {
      '#eeeeee': '#ff0000'
    });
    expect(saida).toBe('<svg><path fill="#ff0000"/><path fill="#111"/></svg>');
  });

  it('reescreve stop-color, que e 15% dos arquivos', () => {
    const saida = applySvgPaintOverrides(
      '<svg><linearGradient id="g"><stop stop-color="#dddddd"/></linearGradient></svg>',
      { '#dddddd': '#101010' }
    );
    expect(saida).toContain('stop-color="#101010"');
  });

  it('reescreve dentro de style inline sem tocar nas outras declaracoes', () => {
    const saida = applySvgPaintOverrides(
      '<svg><path style="fill:#a4a5a6;stroke-width:2;stroke:#111"/></svg>',
      { '#a4a5a6': '#ffffff' }
    );
    expect(saida).toContain('fill:#ffffff');
    expect(saida).toContain('stroke-width:2');
    // `stroke:#111` segue byte-identico: nao esta no mapa.
    expect(saida).toBe('<svg><path style="fill:#ffffff;stroke-width:2;stroke:#111"/></svg>');
  });

  it('preserva as aspas do arquivo', () => {
    expect(applySvgPaintOverrides("<svg><path fill='#ffffff'/></svg>", { '#ffffff': '#000' })).toContain(
      "fill='#000'"
    );
  });

  it('NUNCA reescreve url() — reescrever apagaria o gradiente', () => {
    // O erro mais caro desta feature: `fill="url(#g)"` trocado por uma cor destroi o
    // gradiente, e so apareceria no icone que a pessoa mais gosta.
    const markup = '<svg><path fill="url(#g)"/><path fill="#ffffff"/></svg>';
    const saida = applySvgPaintOverrides(markup, { '#ffffff': '#000000' });
    expect(saida).toContain('fill="url(#g)"');
    expect(saida).toContain('fill="#000000"');
  });

  it('NUNCA reescreve none', () => {
    const markup = '<svg><g fill="none"><path fill="#fff"/></g></svg>';
    expect(applySvgPaintOverrides(markup, { '#ffffff': '#000' })).toContain('fill="none"');
  });

  it('nao reescreve fill-rule nem fill-opacity', () => {
    const saida = applySvgPaintOverrides('<svg><path fill-rule="evenodd" fill-opacity="0.3"/></svg>', {
      '#evenodd': '#000',
      '#0.3': '#000'
    });
    expect(saida).toBe('<svg><path fill-rule="evenodd" fill-opacity="0.3"/></svg>');
  });

  it('aplica duas substituicoes ao mesmo tempo', () => {
    const saida = applySvgPaintOverrides('<svg><path fill="#000"/><path fill="#fff"/></svg>', {
      '#000000': '#111111',
      '#ffffff': '#eeeeee'
    });
    expect(saida).toContain('#111111');
    expect(saida).toContain('#eeeeee');
  });
});

describe('pruneSvgPaintOverrides', () => {
  it('descarta o que nao muda nada', () => {
    expect(pruneSvgPaintOverrides({ '#ffffff': '#ffffff', '#000': '#000000' })).toEqual({});
    expect(pruneSvgPaintOverrides(undefined)).toEqual({});
  });

  it('descarta o que nao e cor', () => {
    expect(pruneSvgPaintOverrides({ '#ffffff': 'none' })).toEqual({});
    expect(pruneSvgPaintOverrides({ 'url(#g)': '#fff' })).toEqual({});
  });

  it('normaliza as duas pontas, para o mapa ter sempre chave #rrggbb', () => {
    expect(pruneSvgPaintOverrides({ white: 'BLACK' })).toEqual({ '#ffffff': '#000000' });
  });

  it('sobrevive ao round trip: extrair, trocar, extrair de novo', () => {
    // O ciclo que a UI vai fazer: lista as cores, o dono escolhe uma, o mapa volta
    // para o renderer. Se a chave nao sobreviver, o override nao aplica e nao ha erro.
    const original = '<svg><path fill="black" stroke="#ddd"/></svg>';
    const cores = extractSvgPaintColors(original);
    const alvo = cores.find((c) => c.hex === '#000000');
    expect(alvo).toBeDefined();

    const mapa = pruneSvgPaintOverrides({ [alvo!.hex]: '#123456' });
    const aplicado = applySvgPaintOverrides(original, mapa);
    expect(aplicado).toContain('#123456');

    const depois = extractSvgPaintColors(aplicado);
    expect(depois.find((c) => c.hex === '#123456')?.count).toBe(1);
    // A outra cor nao foi mexida.
    expect(depois.find((c) => c.hex === '#dddddd')?.count).toBe(1);
  });
});