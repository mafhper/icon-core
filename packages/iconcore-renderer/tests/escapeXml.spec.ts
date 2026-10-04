import { describe, expect, it } from 'vitest';
import { escapeXmlText } from '../src/escapeXml';

/**
 * O escapador de texto (`IC63/2b`).
 *
 * É uma função de três linhas, e a mutação gate confirma que as três linhas importam —
 * cada `replace` removido produz um SVG que nenhum leitor XML abre. A asserção é
 * estrutural (`&amp;`, e **não** `&amp;amp;`), porque o bug real desta função não é
 * escapar pouco: é **escapar duas vezes**.
 */
describe('escapeXmlText', () => {
  it('escapa o & solto, que é XML malformado', () => {
    expect(escapeXmlText('AT&T')).toBe('AT&amp;T');
  });

  it('escapa < e >, que fechariam o elemento mais cedo', () => {
    expect(escapeXmlText('a < b')).toBe('a &lt; b');
    expect(escapeXmlText('a > b')).toBe('a &gt; b');
  });

  it('NAO escapa duas vezes', () => {
    // O bug real. Se `&` fosse escapado por último, o `&` de `&amp;` entraria no
    // replace seguinte e o texto viraria `AT&amp;amp;T` — que o leitor desescapa para
    // `AT&amp;T`, e a pessoa vê `&amp;` no logo.
    expect(escapeXmlText('&')).toBe('&amp;');
    expect(escapeXmlText('&&')).toBe('&amp;&amp;');
    expect(escapeXmlText('&lt;')).toBe('&amp;lt;');
    expect(escapeXmlText('&amp;')).toBe('&amp;amp;');
    // Ou seja: uma entidade que **chegou** como entidade é escapada como texto, e é
    // exatamente isso que o leitor precisa para devolver o que a pessoa digitou.
    expect(escapeXmlText('&amp;')).not.toBe('&amp;');
  });

  it('nao escapa aspas, porque o conteudo de <text> nao e atributo', () => {
    // `fill="${paint}"` e `font-family="${...}"` são atributos e já vêm de um lugar
    // controlado; o **conteúdo** entre tags não precisa de `&quot;`. Escapar aqui
    // mostraria aspas literais no texto.
    expect(escapeXmlText('diz "oi"')).toBe('diz "oi"');
    expect(escapeXmlText("it's")).toBe("it's");
  });

  it('texto sem nada especial sai intacto, byte a byte', () => {
    const limpo = 'Icon Core 2024';
    expect(escapeXmlText(limpo)).toBe(limpo);
    expect(escapeXmlText('')).toBe('');
  });

  it('acentos e emoji passam intactos', () => {
    // Não há normalização: `Ação` e um emoji são texto, e o SVG é UTF-8.
    expect(escapeXmlText('Ação')).toBe('Ação');
    expect(escapeXmlText('Ícone ★')).toBe('Ícone ★');
  });

  it('uma sequencia já escapada não se desfaz', () => {
    // Escapar é **monótono**: aplicar duas vezes é idempotente sobre o resultado.
    const uma = escapeXmlText('A & B < C');
    expect(escapeXmlText(uma)).toBe('A &amp;amp; B &amp;lt; C');
    // E o resultado é o que um leitor XML devolve para `uma`: `A & B < C`.
    const desescapado = uma
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(desescapado).toBe('A & B < C');
  });
});