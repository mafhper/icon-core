/**
 * Overrides de cor por layer `svg`.
 *
 * Um SVG importado não tem pintura no nosso modelo: a cor mora no **markup**, e o
 * renderer injeta o documento verbatim (`renderToSvg.ts:391-419`). A camada não tem
 * `fill`, então o `Fill` do inspector mostra "transparent" e não faz nada — e mesmo
 * com um `fill` definido, o renderer não leria.
 *
 * A resposta não é "pintar o SVG inteiro", que achataria arte multicolorida. É
 * **ler as cores que o arquivo realmente usa e deixar cada uma ser sobreposta**. Um
 * ícone de duas cores continua de duas cores, com a branca trocada.
 *
 * ## Por que funções puras, e aqui
 *
 * Canvas e SVG são **dois** pipelines: o canvas rasteriza a layer por `Image`, e o SVG
 * injeta o markup. Se a reescrita fosse feita em dois lugares, qualquer divergência
 * seria o `IC-N28` de novo — dois pipelines que ninguém compara. Uma função, dois
 * chamadores: a concordância sai **por construção**.
 *
 * ## O que a medição do corpus impôs
 *
 * 1816 SVG do acervo (`investigations/runeicons`):
 *
 * | onde a cor mora            | %    |
 * |---------------------------|------|
 * | `fill=` como atributo     | 100% |
 * | `stroke=` como atributo   | 74%  |
 * | `style="fill:…"`          | 13%  |
 * | `<linearGradient>`/`stop-color` | 15% |
 * | bloco `<style>`           | 0%   |
 *
 * Três consequências que um parser "óbvio" erra:
 *
 * 1. **`black` nomeada, 17.414 ocorrências.** Sem normalizar nome para hex, `black` e
 *    `#000` viram dois swatches da mesma cor.
 * 2. **`fill="none"` em 100% dos arquivos** — é o wrapper. Se entrar na lista, o
 *    primeiro swatch é "none", que não é cor.
 * 3. **`stop-color` tem de entrar**, senão 15% dos ícones ficam sem override nenhum.
 *
 * ## Cuidado com o que NÃO é cor
 *
 * `url(#gradiente)`, `inherit`, `none`, `transparent` e `context-fill` não são paint
 * de cor. Reescrever `url(#a)` por uma cor quebraria o gradiente inteiro, e é o tipo
 * de erro que só aparece no ícone que a pessoa mais gosta.
 */

/**
 * Propriedades que carregam uma cor de paint.
 *
 * Não é uma lista de nomes válidos — é o que o texto **casa**, e o regex exige o `=`
 * logo depois. É por isso que `fill-rule` e `fill-opacity` não entram: o que segue a
 * propriedade é `-rule`, não `=`.
 */
export type SvgPaintRole = 'fill' | 'stroke' | 'stop-color';

/**
 * Valores que **parecem** cor mas não são, e que não podem virar chave de override.
 *
 * `url(#id)` é a referência a um paint server — gradiente, máscara, padrão. Reescrever
 * por uma cor não "substitui o gradiente", **apaga o gradiente**. `inherit` e
 * `context-*` resolvem a partir de fora do próprio elemento, então uma cor nova seria
 * uma mentira sobre o que o arquivo autorou.
 *
 * `currentColor` **não** está aqui, apesar de parecer da mesma família: ele resolve
 * para a propriedade `color` do elemento, que neste contexto é o próprio fill — e
 * sobrescrevê-lo é exatamente o que a pessoa quer quando o ícone é todo `currentColor`.
 * Estava na lista na primeira versão, ao lado de `none`, e a própria justificativa do
 * código dizia o contrário.
 */
const NAO_E_COR = new Set([
  'none',
  'transparent',
  'inherit',
  'unset',
  'initial',
  'auto',
  'context-fill',
  'context-stroke'
]);

/**
 * Cores nomeadas do CSS, em vez de só `black` e `white`.
 *
 * A tabela completa é a diferença entre "deduplica" e "deduplica quase sempre": um
 * arquivo que usa `red` e outro que usa `#ff0000` são a mesma cor e precisam ser o
 * mesmo swatch. Uma lista parcial falharia calada, que é o pior jeito de falhar.
 *
 * Guardada como string única e dividida uma vez: 148 entradas como object literal
 * custariam mais bytes no bundle e mais parse.
 */
const NOMES_CSS =
  'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 ' +
  'black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 ' +
  'cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc ' +
  'crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 ' +
  'darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f ' +
  'darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f ' +
  'darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 ' +
  'deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 ' +
  'floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 ' +
  'goldenrod:daa520 gray:808080 grey:808080 green:008000 greenyellow:adff2f honeydew:f0fff0 hotpink:ff69b4 ' +
  'indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 ' +
  'lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff ' +
  'lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgrey:d3d3d3 lightgreen:90ee90 lightpink:ffb6c1 ' +
  'lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 ' +
  'lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff ' +
  'maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db ' +
  'mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc ' +
  'mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 ' +
  'navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 ' +
  'orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee ' +
  'palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd ' +
  'powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 ' +
  'saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d ' +
  'silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa ' +
  'springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 ' +
  'turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32';

const HEX_NOMES: Map<string, string> = new Map(
  NOMES_CSS.split(' ')
    .filter(Boolean)
    .map((entrada) => {
      const [nome, hex] = entrada.split(':');
      return [nome, `#${hex}`] as [string, string];
    })
);

const canal = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/**
 * `rgb(…)` / `rgba(…)` → `#rrggbb`, **sem regex**.
 *
 * Aceita os três separadores que a especificação permite (vírgula, espaço e barra) e
 * porcentagem, porque um SVG real usa os três. Alpha é ignorado na chave, como no hex de
 * 8 dígitos — `#abcd` e `#abbb` são a mesma cor para o olho, e duas chaves para uma cor
 * fariam dois swatches.
 *
 * O corpo é separado por `split` sobre um conjunto de caracteres, e não por regex com
 * quantificador: é a diferença entre custo linear e quadrático num input que é o
 * conteúdo de um arquivo arbitrário.
 *
 * Devolve `null` para o que não der, e o chamador trata como token opaco — destino
 * honesto para `rgb(a,b,c)`.
 */
const parseRgbFunction = (texto: string): string | null => {
  if (!texto.startsWith('rgb(') && !texto.startsWith('rgba(')) return null;

  // O corpo é **exatamente** o que está entre o `(` e o `)` finais.
  //
  // `rgb(1,2,3)extra)` tem um `(` na posição 3 e um `)` no fim, e o que está entre eles
  // não é só o corpo — é o corpo mais lixo. Por isso o `)` tem de ser o **último
  // caractere**: sem essa checagem, `rgb(1,2,3)x` também passaria, porque o
  // `lastIndexOf` acha um parêntese que existe, e a cor viraria válida vindo de um texto
  // que não é uma cor.
  const abre = texto.indexOf('(');
  const fecha = texto.lastIndexOf(')');
  if (fecha <= abre || fecha !== texto.length - 1) return null;

  const corpo = texto.slice(abre + 1, fecha).trim();

  /**
   * Cada componente tem de ser **so numero**. Um scan caractere a caractere, e nao
   * `parseFloat` + validacao: `parseFloat('12abc')` devolve `12` com o resto descartado,
   * e a validacao depois nao tem como saber que algo foi jogado fora.
   *
   * E o que faz `rgb(12abc, 0, 0)` virar `#0c0000` — uma cor **inventada**, sem erro em
   * lugar nenhum, e com o override apontando para ela. Cor errada que nao reclama e a
   * pior classe de defeito aqui: nao ha sintoma para investigar.
   */
  const numeros: number[] = [];
  const porcentagens: boolean[] = [];
  let i = 0;
  let canalAtual = '';

  const fecharCanal = (): boolean => {
    if (canalAtual === '') return false;
    const ehPorcentagem = canalAtual.endsWith('%');
    const corpoNumero = ehPorcentagem ? canalAtual.slice(0, -1) : canalAtual;
    if (corpoNumero === '') return false;
    // Um canal e **so digitos**, com no maximo um ponto decimal.
    //
    // `Number()` sozinho nao basta, e o motivo e fino: `Number('12abc')` e `NaN` (bom),
    // mas `Number('1.2.3')` e `NaN` tambem, enquanto **`parseFloat('12abc')` e `12`**.
    // A primeira versao usava `parseFloat` e so recusava `isNaN`, entao `rgb(12abc, 0, 0)`
    // virava `#0c0000` — uma cor inventada, sem erro em lugar nenhum.
    if (!/^[0-9]+(\.[0-9]+)?$/.test(corpoNumero)) return false;
    const n = Number(corpoNumero);
    if (!Number.isFinite(n) || n < 0 || n > 255) return false;
    numeros.push(ehPorcentagem ? (n / 100) * 255 : n);
    porcentagens.push(ehPorcentagem);
    canalAtual = '';
    return true;
  };

  while (i < corpo.length) {
    const ch = corpo[i];
    const separador = ch === ',' || ch === '/' || ch === ' ';
    if (separador) {
      // Um separador seguido de outro, ou no fim, nao fecha canal: `rgb(1, 2, 3)`
      // deixa o espaco final sem numero.
      if (canalAtual !== '' && !fecharCanal()) return null;
      canalAtual = '';
      i += 1;
      continue;
    }
    // `12abc` — a letra entra no pedaco, e `^[0-9.]+$` recusa. Um sinal negativo
    // tambem: `rgb(-1, 0, 0)` e invalido e precisa ser recusado, e o `-` cai aqui.
    if (!/[0-9.%]/.test(ch)) return null;
    canalAtual += ch;
    i += 1;
  }
  if (canalAtual !== '' && !fecharCanal()) return null;

  // Três canais, ou três mais alpha.
  if (numeros.length !== 3 && numeros.length !== 4) return null;

  // O quarto só é alpha se estiver na faixa 0..1 — e um alpha percentual também.
  // Sem esta checagem, `rgb(1, 2, 3, 4)` viraria `#010203`: o `4` entraria no lugar do
  // azul, e a cor pareceria válida vindo de texto que não é uma cor.
  if (numeros.length === 4) {
    const alpha = porcentagens[3] ? numeros[3] / 255 : numeros[3];
    if (!(alpha >= 0 && alpha <= 1)) return null;
  }

  return `#${numeros.slice(0, 3).map((n) => canal(n)).join('')}`;
};

/**
 * Normaliza qualquer paint de cor para `#rrggbb` minúsculo.
 *
 * Devolve `null` para o que não é cor — e `null` é a diferença entre "não aparece na
 * lista" e "aparece como `none`", que é o bug que os 100% de `fill="none"` do corpus
 * produziriam.
 */
export const normalizeSvgPaint = (value: string): string | null => {
  const bruto = value.trim();
  if (!bruto) return null;

  const minusculo = bruto.toLowerCase();

  // **Estes dois guards carregam peso, e a medicao de mutacao prova.**
  //
  // Eles parecem redundantes: `none`, `inherit` e `url(#g)` nao sao hex, nao estao na
  // tabela de nomes, e nao sao `rgb()` — o fallthrough ja devolveria `null`. E era
  // exatamente esse o defeito da primeira versao: os testes passavam com os guards
  // desligados, porque o **fallthrough** era quem rechazava, e nao eles. Um guard que
  // nao pode ser distinguido do ausencia de guard nao esta testado.
  //
  // Eles viram carga real abaixo, onde `currentColor`, as system colors e as funcoes
  // `lab()`/`oklch()`/`color()` passam a ser aceitos como token opaco. Nesse mundo,
  // `none` e `inherit` seriam aceitos por qualquer parser, e `url(#g)` poderia ser
  // confundido com um nome. E o `url()` nao e uma rejeicaoestheticamente pequena:
  // reescrever `fill="url(#g)"` por uma cor **apaga o gradiente inteiro**.
  if (NAO_E_COR.has(minusculo)) return null;
  if (minusculo.startsWith('url(')) return null;

  if (minusculo.startsWith('#')) {
    const hex = minusculo.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      // `#abc` -> `#aabbcc`. A forma de 4 dígitos tem alpha; o alpha não participa da
      // chave, senão `#abcd` e `#abbb` seriam cores distintas para o mesmo olho.
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 8) return `#${hex.slice(0, 6)}`;
    return null;
  }

  const nomeado = HEX_NOMES.get(minusculo);
  if (nomeado) return nomeado;

  // `rgb()` / `rgba()`. **Sem regex** — CodeQL marcou a versão anterior
  // (`/^rgba?\(\s*([^)]+)\)$/`) como *polynomial regular expression used on
  // uncontrolled data*, severidade alta: uma string `rgb(` com muitos espaços faz o
  // casamento explodir quadraticamente. E o input é literalmente não controlado — é o
  // conteúdo de um arquivo que a pessoa arrasta para o app.
  //
  // O próprio pacote já tinha o caminho certo: `color.ts:84` diz "sem regex
  // (ReDoS-safe)" e faz o mesmo parse com `indexOf`/`slice`. Segui-o em vez de inventar
  // uma variante.
  const rgb = parseRgbFunction(minusculo);
  if (rgb) return rgb;

  /**
   * Token opaco: `currentColor`, system colors (`CanvasText`), e as funcoes de cor que
   * o browser resolve (`lab()`, `oklch()`, `color()`).
   *
   * Não aparece no corpus do Rune — **0%** de `currentColor` — mas é comum em ícones
   * do mundo real, e sem esta linha a cor ficaria travada justamente nos arquivos que
   * a pessoa trouxe de fora.
   *
   * A chave é o próprio token em minúsculas, não um hex: normalizar para hex exigiria
   * um avaliador de cor do browser, e o valor entregue ao override é a string que o
   * browser entende.
   */
  if (/^-?[a-z][a-z0-9-]*(\([^()]*\))?$/.test(minusculo)) return minusculo;

  return null;
};

/** Uma cor encontrada no arquivo, com onde ela aparece. */
export interface SvgPaintColor {
  /** `#rrggbb` minúsculo — é a chave que um override mapeia. */
  hex: string;
  /** Quantas referências de paint usam esta cor. Serve para ordenar por relevância. */
  count: number;
  /** Quais propriedades carregam esta cor. */
  roles: SvgPaintRole[];
  /** O literal como estava no arquivo, para devolução fiel quando não há override. */
  literal: string;
}

/**
 * Atributo de paint: `fill="…"`. O `(^|[\s<])` evita casar `fill` dentro de outro
 * nome, e o `\s*=\s*` garante que o que segue é o valor — é o que impede `fill-rule` e
 * `fill-opacity` de entrarem como cor.
 */
const ATRIBUTO_PAINT = /(^|[\s<])(fill|stroke|stop-color)(\s*=\s*)("([^"]*)"|'([^']*)')/g;

/** Declaração dentro de `style="…"`: `fill:#fff`. */
const DECLARACAO_PAINT = /(?:^|;)\s*(fill|stroke|stop-color)\s*:\s*([^;"']+)/gi;

/**
 * As cores de paint que o arquivo realmente usa.
 *
 * Ordenadas por contagem decrescente e depois por hex, para a lista ser **estável**:
 * dois arquivos com as mesmas cores dão a mesma ordem, e o swatch não "pula" quando o
 * usuário abre outro ícone.
 */
export const extractSvgPaintColors = (markup: string): SvgPaintColor[] => {
  const encontrados = new Map<string, SvgPaintColor>();

  const registrar = (role: SvgPaintRole, literal: string) => {
    const hex = normalizeSvgPaint(literal);
    if (!hex) return;
    const existente = encontrados.get(hex);
    if (existente) {
      existente.count += 1;
      if (!existente.roles.includes(role)) existente.roles.push(role);
      return;
    }
    encontrados.set(hex, { hex, count: 1, roles: [role], literal: literal.trim() });
  };

  for (const m of markup.matchAll(ATRIBUTO_PAINT)) {
    const role = m[2].toLowerCase() as SvgPaintRole;
    registrar(role, m[5] ?? m[6] ?? '');
  }

  // `style="fill:#fff;stroke:red"` — 13,5% dos arquivos do corpus.
  for (const m of markup.matchAll(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const bloco = m[2] ?? m[3] ?? '';
    for (const d of bloco.matchAll(DECLARACAO_PAINT)) {
      registrar(d[1].toLowerCase() as SvgPaintRole, d[2]);
    }
  }

  return [...encontrados.values()].sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
};

/**
 * Reescreve as cores de paint mapeadas, deixando o resto do markup intacto.
 *
 * Sem overrides, devolve a entrada **exatamente** — aidentity é o que permite chamar
 * isso em todo layer sem custo e sem risco.
 *
 * Só reescreve quando a chave existe no mapa. Um paint que não está no mapa é deixado
 * como estava, porque o mapa é do **layer**, e outro layer do mesmo arquivo tem o seu.
 */
export const applySvgPaintOverrides = (markup: string, overrides: Record<string, string>): string => {
  const entradas = Object.entries(overrides).filter(([de, para]) => de !== para);
  if (entradas.length === 0) return markup;

  /** Chave normalizada -> valor normalizado (ou o literal, se não normalizar). */
  const mapa = new Map<string, string>();
  for (const [de, para] of entradas) {
    mapa.set(de.toLowerCase(), para.trim());
  }

  const resolver = (literal: string): string => {
    const hex = normalizeSvgPaint(literal);
    if (!hex) return literal;
    const substituto = mapa.get(hex);
    return substituto ?? literal;
  };

  let saida = markup.replace(ATRIBUTO_PAINT, (todo, prefixo: string, attr: string, sep: string, _citado, duplas: string | undefined, simples: string | undefined) => {
    const valor = duplas ?? simples ?? '';
    const novo = resolver(valor);
    if (novo === valor) return todo;
    const abertura = duplas !== undefined ? '"' : "'";
    return `${prefixo}${attr}${sep}${abertura}${novo}${abertura}`;
  });

  saida = saida.replace(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/g, (todo, _citado, duplas: string | undefined, simples: string | undefined) => {
    const abertura = duplas !== undefined ? '"' : "'";
    const bloco = duplas ?? simples ?? '';
    const novo = bloco.replace(DECLARACAO_PAINT, (dTodo: string, prop: string, valor: string) => {
      const substituto = resolver(valor);
      if (substituto === valor) return dTodo;
      return `${prop}:${substituto}`;
    });
    return novo === bloco ? todo : `style=${abertura}${novo}${abertura}`;
  });

  return saida;
};

/** O mapa de overrides, com as entradas que não mudam nada removidas. */
export const pruneSvgPaintOverrides = (overrides: Record<string, string> | undefined): Record<string, string> => {
  const saida: Record<string, string> = {};
  for (const [de, para] of Object.entries(overrides ?? {})) {
    const origem = normalizeSvgPaint(de);
    const destino = normalizeSvgPaint(para);
    if (!origem || !destino || origem === destino) continue;
    saida[origem] = destino;
  }
  return saida;
};
