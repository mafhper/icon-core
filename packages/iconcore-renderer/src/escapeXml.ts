/**
 * Escape de conteúdo de texto para dentro de um elemento SVG.
 *
 * ## O defeito que isto corrige
 *
 * `renderToSvg` interpolava `layer.text.content` direto no markup. Um logo com `AT&T`
 * no texto gerava um SVG com `&` solto — **XML malformado**, que nenhum leitor abre. E
 * `<` fecharia o elemento mais cedo: o texto sumiria e o resto do documento viraria lixo.
 *
 * Não é um caso exótico: `&` aparece em nome de marca ("Smith & Sons"), e `<` é comum
 * em logo de tecnologia. Nenhum teste media isso — as fixtures de texto usavam "Icon" e
 * "Wg", que não têm nada disso.
 *
 * ## Por que uma função separada, e não `sanitizeSvg`
 *
 * `sanitizeSvg` remove **tags** perigosas de um documento que a pessoa arrastou para o
 * app. Isto é o oposto: é o **nosso** texto de saída, que precisa ser bem formado. As
 * duas coisas não se misturam — e uma função que fizesse as duas teria um nome que mente
 * sobre as duas.
 *
 * ## A ordem de `&`
 *
 * `&` primeiro, e não por elegância: se fosse escapado por último, o `&` de `&amp;` seria
 * escapado de novo e o texto viraria `&amp;amp;`. Por isso a ordem, e por isso três
 * `replace` em vez de uma regex.
 */
export const escapeXmlText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
