/**
 * Onde o texto é desenhado, e com que âncora.
 *
 * ## O problema que isto resolve
 *
 * O texto era desenhado **sempre no centro do canvas**, em ambos os pipelines:
 * `fillText(content, S/2, S/2)` com `textAlign = 'center'`, e `<text x="S/2"
 * text-anchor="middle">`. Alinhar à esquerda significava mudar `textAlign` para
 * `'left'` e o texto **cresceria para a direita a partir do centro** — o oposto do que
 * a pessoa quer. Sem uma caixa de referência, não há "esquerda" de que falar.
 *
 * A caixa é o **shape da layer**, que já existe desde `createTextLayer`
 * (`projectFactory.ts:234-238`, 58% da largura do canvas). Não é um conceito novo: é o
 * retângulo que a layer já ocupa e que o resize já respeita.
 *
 * ## Por que uma função, e não duas edições
 *
 * Canvas e SVG são dois pipelines, e é exatamente assim que o `IC-N28` aconteceu — duas
 * implementações que ninguém compara. A regra que saiu daqui: **a geometria mora numa
 * função pura, e cada pipeline só a consome.** O canvas traduz para `textAlign` + `x`; o
 * SVG traduz para `text-anchor` + `x`. Se divergirem um dia, a fixture de paridade de
 * texto pega.
 */
export type TextAlign = 'left' | 'center' | 'right';

/** O vocabulário do SVG. Separado de `TextAlign` porque os valores não coincidem. */
export type SvgTextAnchor = 'start' | 'middle' | 'end';

export interface TextBox {
  left: number;
  center: number;
  right: number;
}

/** A caixa de alinhamento: o shape da layer, centralizado no canvas. */
export const textBox = (
  canvas: { width: number; height: number },
  shape?: { width: number; height: number }
): TextBox => {
  const w = shape?.width ?? canvas.width;
  return {
    left: (canvas.width - w) / 2,
    center: canvas.width / 2,
    right: (canvas.width + w) / 2
  };
};

/**
 * As duas traduções, em **tabelas** e não em `if`.
 *
 * Com `if (align === 'left') ... if (align === 'right') ... return centro`, acrescentar
 * um quarto valor a `TextAlign` **não quebraria a compilação**: ele cairia no `return` do
 * centro, silenciosamente. `Record<TextAlign, …>` faz o compilador apontar cada tabela
 * que ficou incompleta — que é o ponto: o erro aparece no lugar onde a decisão é tomada.
 *
 * E a asserção de `{anchor, x}` como **unidade** (não `x` e `anchor` soltos) vem
 * disto: os dois saem da mesma linha da tabela, então trocar a âncora sem mover `x`
 * deixa de ser comparável.
 */
const SVG_ANCHOR: Record<TextAlign, SvgTextAnchor> = {
  left: 'start',
  center: 'middle',
  right: 'end'
};

/** `ctx.textAlign` aceita exatamente estes três; `start`/`end` de SVG não são os mesmos. */
const CANVAS_ALIGN: Record<TextAlign, CanvasTextAlign> = {
  left: 'left',
  center: 'center',
  right: 'right'
};

/** Posição da âncora dentro da caixa: 0 = borda esquerda, 1 = borda direita. */
const BOX_EDGE: Record<TextAlign, keyof TextBox> = {
  left: 'left',
  center: 'center',
  right: 'right'
};

export type CanvasTextAlign = 'left' | 'center' | 'right';

export interface TextPlacement {
  x: number;
  y: number;
  svgAnchor: SvgTextAnchor;
  canvasAlign: CanvasTextAlign;
}

/**
 * `center` como fallback, num lugar só.
 *
 * O valor chega de três fontes com capacidades diferentes: o modelo TypeScript diz que é
 * `TextAlign | undefined`; o **arquivo `.iconcore.json` da pessoa** pode conter qualquer
 * coisa, porque `isIconCoreProject` valida só o topo do documento; e a UI produz os três
 * valores. Espalhar `?? 'center'` e `=== 'left'` pelos chamadores daria a cada um o seu
 * default — e foi assim que `undefined` e um valor desconhecido passaram a se comportar
 * diferente em lugares diferentes.
 *
 * `normalizeTextAlign` é a **única** fronteira:_types não protegem contra JSON carregado,
 * e um `.iconcore.json` editado à mão com `textAlign: "justify"` é plausível.
 */
export const normalizeTextAlign = (value: unknown): TextAlign =>
  value === 'left' || value === 'right' ? value : 'center';

/**
 * A coordenada X e a âncora, nos dois vocabulários de uma vez.
 *
 * `svgAnchor` é o atributo `text-anchor`; `canvasAlign` é o `ctx.textAlign`. São
 * vocabulários diferentes para a mesma ideia, e por isso os dois campos existem: quem
 * decide é o chamador, e esta função não sabe qual pipeline está rodando.
 *
 * ## `left`/`right` contra `start`/`end`
 *
 * `start` e `end` no SVG dependem de `direction`. O mapeamento `left → start` **só vale
 * em LTR**, que é tudo que o app suporta hoje: `TextAlign` não tem variante RTL e
 * `direction` não é lido em lugar nenhum do renderer. Se um dia houver RTL, este é o
 * ponto a mudar — e o comentário existe para que ninguém "conserte" os dois lados ao
 * mesmo tempo e reintroduza a divergência.
 */
export const resolveTextPlacement = (
  canvas: { width: number; height: number },
  shape: { width: number; height: number } | undefined,
  align?: TextAlign
): TextPlacement => {
  const box = textBox(canvas, shape);
  const resolvido = normalizeTextAlign(align);
  return {
    x: box[BOX_EDGE[resolvido]],
    y: canvas.height / 2,
    svgAnchor: SVG_ANCHOR[resolvido],
    canvasAlign: CANVAS_ALIGN[resolvido]
  };
};

/** Palavras-chave genéricas: são identificadores válidos e **não** devem ser citadas. */
const GENERICAS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);

/**
 * Um nome de família **sem aspas** é válido em CSS quando é uma sequência de
 * identificadores — `Source Sans 3` é válido, porque `Source`, `Sans` e `3` são três
 * identificadores. (O Agente B afirmou o contrário; a especificação diz que não.)
 *
 * O que realmente quebra, e é o que esta função trata:
 *
 * - nome que **começa com dígito** — `3D Icons`. A regra do identificador CSS é
 *   `-?{nmstart}`, e `nmstart` exclui dígito;
 * - nome com caractere fora do alfabeto permitido;
 * - nome com **espaço nas pontas**, que o CSS descarta em silêncio.
 *
 * Ali o `ctx.font` fica **inválido**, e o canvas **ignora um `ctx.font` inválido em
 * silêncio**, mantendo a fonte anterior. O sintoma é um texto que sai com a fonte errada
 * e nenhum aviso.
 *
 * As sequências são `\u` explícitas de propósito: escrever os caracteres literais nessas
 * classes traz um espaço irregular — que o ESLint acusa — e um `U+FFFD` que não significa
 * nada.
 */
const NOME_INVALIDO_SEM_ASPAS = /^-?[0-9]|[^A-Za-z0-9_\-\s\u00A0-\uFFFF]|^\s|\s$/;

/**
 * Escape de string CSS, em **passada única**.
 *
 * O CodeQL marcou `js/incomplete-sanitization` nesta linha: eu escapava só as aspas, e um
 * `\` na entrada ficava de fora. `\"` na entrada virava `\"` na saída, que o CSS lê como
 * **aspa de fechamento** — e o nome de família saía da citação, deixando o resto do
 * `ctx.font` sob controle de quem escreveu o `.iconcore.json`.
 *
 * A ordem importa: `\` tem que ser escapado **antes** das aspas, senão o `\` introduzido
 * pelo escape da aspa seria escapado de novo. Por isso os dois numa tabela e uma passada
 * só, que é o mesmo motivo de `escapeXml` não encadear `replace`.
 */
const ESCAPE_CSS: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"'
};

/** Cita um nome de família só quando ele precisa. `Inter, Sora, sans-serif` passa inteiro. */
export const cssFontFamily = (fontFamily: string): string =>
  fontFamily
    .split(',')
    .map((parte) => {
      const nome = parte.trim();
      if (nome === '' || nome.startsWith('"') || nome.startsWith("'")) return nome;
      if (GENERICAS.has(nome.toLowerCase())) return nome;
      if (!NOME_INVALIDO_SEM_ASPAS.test(nome)) return nome;
      return `"${nome.replace(/[\\"]/g, (ch) => ESCAPE_CSS[ch])}"`;
    })
    .join(', ');

/**
 * A assinatura de fonte para o canvas.
 *
 * A ordem **importa** e é uma fonte clássica de diferença silenciosa: a gramática do
 * Canvas é `[italic] [weight] size family`, e `italic 700 96px X` é o que o navegador
 * entende. O SVG não tem assinatura — recebe `font-style` e `font-weight` como atributos
 * separados.
 *
 * O `fontStyle` entra **tipado**, não como `string`: a versão anterior aceitava qualquer
 * `string` e decidia com `=== 'italic' || === 'oblique'`. Um valor vindo de JSON
 * desconhecido caía em "não itálico" sem nenhuma etapa de normalização — a mesma classe
 * de bug que `normalizeTextAlign` resolve do outro lado.
 */
export type FontStyle = 'normal' | 'italic';

export interface CanvasFontInput {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: FontStyle;
}

/** `italic` é o único valor que muda a assinatura. `oblique` saiu do modelo. */
export const isItalic = (fontStyle?: FontStyle): boolean => fontStyle === 'italic';

export const canvasFontShorthand = (text: CanvasFontInput): string =>
  `${isItalic(text.fontStyle) ? 'italic ' : ''}${text.fontWeight} ${text.fontSize}px ${cssFontFamily(text.fontFamily)}`;