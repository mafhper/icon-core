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
 * texto pega — que é o que a fixture `texto` passou a fazer depois que apareceu.
 */
export type TextAlign = 'left' | 'center' | 'right';

export interface TextBox {
  left: number;
  center: number;
  right: number;
}

/** A caixa de alinhamento: o shape da layer, centralizado no canvas. */
export const textBox = (canvas: { width: number; height: number }, shape?: { width: number; height: number }): TextBox => {
  const w = shape?.width ?? canvas.width;
  return {
    left: (canvas.width - w) / 2,
    center: canvas.width / 2,
    right: (canvas.width + w) / 2
  };
};

/**
 * A coordenada X e a âncora, nos dois vocabulários de uma vez.
 *
 * `svgAnchor` é o atributo `text-anchor`; `canvasAlign` é o `ctx.textAlign`. São
 * vocabulários diferentes para a mesma ideia, e por isso os dois campos existem: quem
 * decide é o chamador, e esta função não sabe qual pipeline está rodando.
 */
/**
 * `align` é `TextAlign | undefined` **sem default**, e o `center` vem do `return` final.
 *
 * A primeira versão tinha `= 'center'` no parâmetro *e* o `return` final como centro. São
 * dois mecanismos para a mesma regra, e a redundância custou caro: a mutação "tira o
 * default" **não mudava nada**, porque `undefined` caía no mesmo `return`. Era uma
 * mutação equivalente — o tipo de coisa que parece um buraco no gate e é só código morto.
 *
 * Um mecanismo só. E o `return` final é o lugar certo: é o caminho que `undefined` e
 * qualquer valor fora do conjunto tomam, que é a mesma coisa.
 */
export const resolveTextPlacement = (
  canvas: { width: number; height: number },
  shape: { width: number; height: number } | undefined,
  align?: TextAlign
): { x: number; y: number; svgAnchor: 'start' | 'middle' | 'end'; canvasAlign: 'left' | 'center' | 'right' } => {
  const box = textBox(canvas, shape);

  if (align === 'left') {
    return { x: box.left, y: canvas.height / 2, svgAnchor: 'start', canvasAlign: 'left' };
  }
  if (align === 'right') {
    return { x: box.right, y: canvas.height / 2, svgAnchor: 'end', canvasAlign: 'right' };
  }
  return { x: box.center, y: canvas.height / 2, svgAnchor: 'middle', canvasAlign: 'center' };
};

/**
 * A assinatura de fonte para o canvas.
 *
 * A ordem **importa** e é uma fonte clássica de diferença silenciosa: a gramática do
 * Canvas é `[italic] [weight] size family`, e `oblique 700 96px X` é inválido enquanto
 * `italic 700 96px X` é o que o navegador entende. O SVG, por outro lado, não tem
 * assinatura — ele recebe `font-style` e `font-weight` como atributos separados.
 */
export const canvasFontShorthand = (text: {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: string;
}): string => {
  const italico = text.fontStyle === 'italic' || text.fontStyle === 'oblique' ? 'italic ' : '';
  return `${italico}${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
};
