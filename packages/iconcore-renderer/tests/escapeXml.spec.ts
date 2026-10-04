import { describe, expect, it } from 'vitest';
import type { Fill, IconCoreProject, IconLayer, IconVariant } from '@iconcore/shared';
import { escapeXml } from '../src/escapeXml';
import { renderToSvg } from '../src/renderToSvg';

/**
 * O defeito que estes testes cobrem foi **descoberto por acaso**: um `&` apareceu num logo
 * real e o SVG saiu malformado. Nenhum teste media isso, porque as fixtures de texto eram
 * `"Icon"` e `"Wg"` — que não têm nada de especial.
 *
 * A regra que este arquivo segue: para cada caractere perigoso, um **valor absoluto
 * esperado**, escrito à mão. Comparar duas saídas entre si só prova que as duas bateram.
 */

const solidFill: Fill = { kind: 'solid', color: '#000000' };

const textLayer = (content: string, fontFamily = 'Arial'): IconLayer => ({
  id: 'text-1',
  name: 'Text',
  kind: 'text',
  visible: true,
  zIndex: 1,
  source: { type: 'inline', mimeType: 'image/svg+xml', data: '' },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: solidFill,
  text: { content, fontFamily, fontSize: 24, fontWeight: 400 }
});

const projectWith = (layer: IconLayer): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'T', shortName: 'T' },
  canvas: { size: 256, background: solidFill },
  layers: [layer],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 't', quality: 0.95, generateReport: false }
});

const variant: IconVariant = 'default';

describe('escapeXml', () => {
  it('escapa os cinco caracteres predefinidos', () => {
    // Valores absolutos, escritos à mão. Se alguém encadear dois `replace`, este teste
    // reprova — que é o objetivo.
    expect(escapeXml('&')).toBe('&amp;');
    expect(escapeXml('<')).toBe('&lt;');
    expect(escapeXml('>')).toBe('&gt;');
    expect(escapeXml('"')).toBe('&quot;');
    expect(escapeXml("'")).toBe('&apos;');
  });

  it('NAO escapa duas vezes (a ordem do escape e load-bearing)', () => {
    // Se `&` fosse escapado por ultimo, `&` viraria `&amp;` e depois `&amp;amp;` — que o
    // leitor desescapa para `&amp;`, e a pessoa ve `&amp;` impresso no logo.
    expect(escapeXml('AT&T')).toBe('AT&amp;T');
    expect(escapeXml('a & b & c')).toBe('a &amp; b &amp; c');
    // A prova de que e passada unica: a entrada so tem `&`, e a saida nao tem `&amp;amp;`.
    expect(escapeXml('AT&T')).not.toContain('&amp;amp;');
  });

  it('trata os casos que aparecem em nome de marca e em logo de tecnologia', () => {
    expect(escapeXml('Smith & Sons')).toBe('Smith &amp; Sons');
    expect(escapeXml('5 < 10')).toBe('5 &lt; 10');
    expect(escapeXml('10 > 5')).toBe('10 &gt; 5');
    expect(escapeXml(']]>')).toBe(']]&gt;');
  });

  it('preserva Unicode valido em vez de corromper', () => {
    // Estes nao precisam ser escapados em XML. O teste existe pelo motivo oposto ao dos
    // outros: garantir que a funcao **nao estraga** texto bom enquanto corrige o ruim.
    expect(escapeXml('acao')).toBe('acao');
    expect(escapeXml('ac\u00e7\u00e3o')).toBe('ac\u00e7\u00e3o');
    expect(escapeXml('\u00c5ngstr\u00f6m')).toBe('\u00c5ngstr\u00f6m');
    expect(escapeXml('\u00a9')).toBe('\u00a9');
    expect(escapeXml('\u65e5\u672c\u8a9e')).toBe('\u65e5\u672c\u8a9e');
    expect(escapeXml('\u041f\u0440\u0438\u0432\u0435\u0442')).toBe('\u041f\u0440\u0438\u0432\u0435\u0442');
    expect(escapeXml('\u{1f642}')).toBe('\u{1f642}');
    // Par de surrogate de um caractere fora do BMP tem de sobreviver intacto.
    expect(escapeXml('\u{1d54f}')).toBe('\u{1d54f}');
  });

  it('remove caracteres de controle, que XML 1.0 proibe', () => {
    // Nao ha representacao escapada para estes: o unico jeito de gerar documento valido e
    // remove-los. Colar texto de um PDF basta para isso acontecer.
    expect(escapeXml('a\u0000b')).toBe('ab');
    expect(escapeXml('a\u0008b')).toBe('ab');
    expect(escapeXml('a\u000Bb')).toBe('ab');
    expect(escapeXml('a\u000Cb')).toBe('ab');
    expect(escapeXml('a\u001Fb')).toBe('ab');
    // \t, \n e \r sao **permitidos** em XML e nao devem sumir.
    expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd');
  });

  it('conserta surrogate solto', () => {
    // Um `\uD800` sem par e invalido e quebra o documento. `toWellFormed()` troca por U+FFFD.
    expect(escapeXml('a\uD800b')).toBe('a\uFFFDb');
    expect(escapeXml('\uDC00')).toBe('\uFFFD');
  });

  it('e no-op em texto que nao tem nada perigoso', () => {
    expect(escapeXml('Icon')).toBe('Icon');
    expect(escapeXml('')).toBe('');
  });
});

describe('renderToSvg — texto com dado da pessoa', () => {
  it('escapa o conteudo antes de o XML ficar malformado', () => {
    const svg = renderToSvg(projectWith(textLayer('AT&T')), variant);
    expect(svg).toContain('>AT&amp;T<');
    // A prova de que o `&` solto sumiu: nao pode sobrar nenhum `&` que nao abra entidade.
    const soltos = [...svg.matchAll(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g)];
    expect(soltos).toHaveLength(0);
  });

  it('escapa a familia da fonte no atributo', () => {
    // Mesmo defeito, outro lugar: uma aspa em `font-family` fecha o atributo e o resto do
    // elemento vira atributo. Era o segundo ponto cego — achado por grep, nao por bug.
    const svg = renderToSvg(projectWith(textLayer('Ok', 'Fira "Code"')), variant);
    expect(svg).toContain('font-family="Fira &quot;Code&quot;"');
  });

  it('nao deixa o conteudo de texto escapar do elemento', () => {
    // Um `<` solto fecha `<text>` mais cedo: o texto some e o resto do documento entra
    // dentro dele. Contar abertura e fechamento prova que o elemento continua unico e inteiro.
    const svg = renderToSvg(projectWith(textLayer('5 < 10')), variant);
    expect(svg).toContain('>5 &lt; 10<');
    expect([...svg.matchAll(/<\/text>/g)]).toHaveLength(1);
    expect([...svg.matchAll(/<text\b/g)]).toHaveLength(1);
  });

  it('mantem o restante do documento intacto', () => {
    // Regressao: escapar nao pode custar o resto do SVG.
    const svg = renderToSvg(projectWith(textLayer('AT&T')), variant);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox');
  });
});