/**
 * Escape de texto para dentro de um SVG.
 *
 * ## O defeito
 *
 * `renderToSvg` interpolava valores da pessoa direto no markup. Um logo com `AT&T` no
 * texto gerava um SVG com `&` solto — **XML malformado, que nenhum leitor abre** — e um
 * `<` fechava o elemento mais cedo: o texto sumiria e o resto do documento viraria lixo.
 *
 * O mesmo defeito estava em `font-family="${layer.text.fontFamily}"`: um nome de família
 * com aspas fecharia o atributo. Um grep das interpolações de `renderToSvg` achou as duas
 * de uma vez, e são as **únicas** duas que recebem dado do `.iconcore.json` — o resto são
 * números e valores derivados.
 *
 * Não é um caso exótico: `&` aparece em nome de marca ("Smith & Sons"), e `<` é comum em
 * logo de tecnologia. **Nenhum teste media isso**, porque as fixtures de texto eram
 * `"Icon"` e `"Wg"`.
 *
 * ## Por que uma função, e não duas
 *
 * A alternativa óbvia seria `escapeXmlText` e `escapeXmlAttribute`. Recusada: a versão de
 * cinco caracteres é **válida nos dois contextos**, e uma função que não pode ser usada
 * incorretamente é melhor que duas que podem. O custo é bytes num texto de elemento, o
 * que é invisível ao olho e irrelevante no tamanho do arquivo.
 *
 * ## As três coisas que não é óbvio
 *
 * **1. A ordem do escape.** Se `&` fosse escapado por último, o `&` de `&amp;` seria
 * escapado de novo e `AT&T` viraria `AT&amp;amp;T` — que o leitor desescapa para
 * `AT&amp;T`, e a pessoa vê `&amp;` no logo. Por isso o mapa é aplicado numa **passada
 * única**, e não em três `replace` encadeados.
 *
 * **2. Caracteres de controle.** XML 1.0 **proíbe** U+0000–U+0008, U+000B, U+000C e
 * U+000E–U+001F. Eles não têm representação escapada: o único jeito de gerar um documento
 * válido é **removê-los**. Colar texto de um PDF basta para isso acontecer — e um
 * escapador que só cuida de `&<>` ainda assim quebra o arquivo.
 *
 * **3. Surrogates soltos.** Uma string pode conter um surrogate sem o par, e isso também é
 * inválido. `toWellFormed()` resolve de uma vez, e `engines` exige Node ≥22, então ele
 * existe em todo lugar que este código roda.
 *
 * ## Por que não `sanitizeSvg`
 *
 * `sanitizeSvg` remove **tags** perigosas de um documento que a pessoa arrastou para o app.
 * Isto é o oposto: é o **nosso** texto de saída, que precisa ser bem formado. As duas
 * coisas não se misturam — e uma função que fizesse as duas teria um nome que mente sobre
 * as duas.
 */

/** XML 1.0 proíbe estes; não há representação escapada, então saem. */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

/**
 * Surrogate sem par. Um `\uD800` sem o `\uDC00` seguinte (ou o inverso) é inválido.
 *
 * `String.prototype.toWellFormed()` resolveria isto, e o runtime tem — mas o `lib` do
 * TypeScript deste pacote é anterior a ES2024, então o compilador não conhece o método.
 * Elevar o `lib` é mudança de build de todo o repositório e não cabe num PR de correção.
 * A regex explícita faz o mesmo pelo mesmo preço, e passa a ser redundante sem quebrar
 * caso `toWellFormed` entre um dia.
 *
 * Sem `eslint-disable`: surrogate nao e caractere de controle, e a regra `no-control-regex`
 * nao dispara aqui. O desnecessario seria um warning, e `--max-warnings 0` reprova.
 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Escapa para XML, válido em **conteúdo de elemento** e em **atributo**.
 *
 * Mono, não uma flag: a função não sabe em que contexto está, e adivinhar é como o
 * defeito entra.
 */
export const escapeXml = (value: string): string =>
  value
    .replace(LONE_SURROGATE, '\uFFFD')
    .replace(INVALID_XML_CHARS, '')
    .replace(/[&<>"']/g, (ch: string) => ENTITIES[ch]);