import { describe, expect, it } from 'vitest';
import { renderToSvg } from '../src/renderToSvg';

/**
 * `IC63/2` — a integração: o `TextDefinition` novo **atravessa** o pipeline.
 *
 * Estes testes não medem geometria (`textLayout.spec.ts`) nem markup isolado
 * (`textSvgMarkup.spec.ts`). Medem que o campo **sobrevive ao caminho completo** — projeto
 * → variante → render — que é onde um campo novo pode ser aceito pelo tipo e ignorado
 * pelo render, sem erro em lugar nenhum.
 *
 * É a mesma classe do `IC-N28` e do id do projeto no #202: as suítes dos dois lados
 * estavam verdes, e o defeito estava na emenda.
 */
const projeto = (text: Record<string, unknown>) => ({
  schemaVersion: 3 as const,
  metadata: { name: 't', shortName: 't' },
  canvas: { size: 256, background: { kind: 'solid' as const, color: '#ffffff' } },
  variants: { default: {} },
  layers: [
    {
      id: 'lt',
      name: 'texto',
      kind: 'text' as const,
      visible: true,
      zIndex: 0,
      source: {
        type: 'reference' as const,
        path: '',
        shape: { kind: 'rectangle' as const, width: 196, height: 44 }
      },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      text: { content: 'Esquerda', fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700, ...text },
      fill: { kind: 'solid' as const, color: '#111827' }
    }
  ]
});

const svg = (p: unknown, variant = 'default'): string => renderToSvg(p as never, variant as never);
const text = (saida: string): string => /<text\b[^>]*>/.exec(saida)?.[0] ?? '';
const attr = (tag: string, nome: string): string | undefined =>
  new RegExp(`\\b${nome}="([^"]*)"`).exec(tag)?.[1];

describe('o campo novo atravessa o pipeline', () => {
  it('textAlign chega ao <text> dentro de um projeto real', () => {
    expect(attr(text(svg(projeto({ textAlign: 'left' }))), 'text-anchor')).toBe('start');
  });

  it('fontStyle chega ao <text> dentro de um projeto real', () => {
    expect(attr(text(svg(projeto({ fontStyle: 'italic' }))), 'font-style')).toBe('italic');
  });

  it('uma variante que sobrepoe o alinhamento ganha do base, e nao o apaga', () => {
    // O merge de `text` é `{ ...layer.text, ...override.text }` nos dois pipelines
    // (`composeLayers.ts:25` e `renderToSvg.ts:43`). Se um deles deixar de fazer o
    // spread, a variante "volta" ao `center` do base — e a pessoa vê o texto centralizar
    // ao trocar de variante, sem nenhum erro.
    const comVariante = {
      ...projeto({ textAlign: 'left', fontSize: 22 }),
      layers: [
        {
          ...projeto({ textAlign: 'left' }).layers[0],
          variantOverrides: {
            dark: { text: { content: 'Esquerda', fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700, textAlign: 'right' as const } }
          }
        }
      ]
    };

    const base = text(svg(comVariante, 'default'));
    const dark = text(svg(comVariante, 'dark'));

    expect(attr(base, 'text-anchor')).toBe('start');
    expect(attr(dark, 'text-anchor')).toBe('end');
    // E o `fontSize` do base sobrevive à variante que não o redeclara — é o mesmo merge.
    expect(attr(dark, 'font-size')).toBe(attr(base, 'font-size'));
  });

  it('o texto escapado sobrevive ao pipeline inteiro', () => {
    // Medido: `AT&T` num projeto real precisa sair `AT&amp;T` no arquivo final. Se
    // alguém trocar `escapeXmlText(...)` por `layer.text.content` num refactor, este
    // teste é o que pega.
    const comAmp = {
      ...projeto({ textAlign: 'left' }),
      layers: [
        {
          ...projeto({}).layers[0],
          text: { content: 'AT&T <™>', fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700 }
        }
      ]
    };
    const saida = svg(comAmp);
    expect(saida).toContain('AT&amp;T &lt;™&gt;');
    expect(saida).not.toMatch(/>AT&T/);
  });

  it('todo & da saída é uma entidade, e nenhum < aparece no conteúdo', () => {
    // A prova de que o escaping resolve o problema que ele diz resolver.
    //
    // **`DOMParser` não serve aqui**: o renderer roda em Node, não em jsdom
    // (`vitest.config.ts` do pacote não declara `environment`, então é `node`), e lá não
    // existe `DOMParser`. A primeira versão deste teste usou um e falhou com
    // "DOMParser is not defined" — o que pareceu falha do escaping.
    //
    // A verificação estrutural é **mais precisa** de qualquer forma: ela diz *qual*
    // caractere está malformado, e um `parsererror` só diria que algo está.
    // Sem aspas no fixture: o `escapeXmlText` **não** escapa aspas (elas não quebram
    // XML em conteúdo de elemento, só em atributo), e o `\"` do meu TypeScript virava
    // `&quot;` na mensagem do vitest — que parecia um `&` solto no SVG e não era.
    // A asserção é sobre `&`, `<` e `>`, que são os três que quebram um elemento.
    const comEspecial = {
      ...projeto({ textAlign: 'left' }),
      layers: [
        {
          ...projeto({}).layers[0],
          text: { content: 'A & B < C > D', fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700 }
        }
      ]
    };
    const saida = svg(comEspecial);

    // 1. Todo `&` abre uma entidade conhecida. Um `&` solto é o defeito inteiro.
    const entidades = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
    const soltos = [...saida.matchAll(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g)];
    expect(
      soltos.map((m) => JSON.stringify(saida.slice(Math.max(0, m.index - 6), m.index + 40))),
      `& solto em ${soltos.length} lugar(es)`
    ).toEqual([]);

    // E a contagem bate: quantos `&` entraram, quantas entidades saíram.
    expect((saida.match(/&/g) ?? []).length).toBe((saida.match(entidades) ?? []).length);

    // 2. O conteúdo de `<text>` não tem `<` cru — ele fecharia o elemento mais cedo.
    const conteudo = [...saida.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
    expect(conteudo.length).toBeGreaterThan(0);
    for (const c of conteudo) {
      expect(c).not.toContain('<');
      expect(c).not.toContain('>');
    }
  });
});
