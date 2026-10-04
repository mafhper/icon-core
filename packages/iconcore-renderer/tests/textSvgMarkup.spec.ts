import { describe, expect, it } from 'vitest';
import { renderToSvg } from '../src/renderToSvg';

/**
 * `renderToSvg(project, variant)` — a assinatura é `(projeto, variant)`, e `variant` é
 * `'default'`. A primeira versão deste arquivo passou `{ width, height }` no segundo
 * lugar, que o TypeScript recusou com "Expected 2 arguments, but got 1" — porque o
 * objeto é o **terceiro** parâmetro, e de `renderToSvgWithOptions`.
 */

/**
 * `IC63/2` — o texto no SVG, por **markup absoluto**.
 *
 * Estas são as asserções que a fixture de paridade **não pode** fazer, e a razão está
 * medida: `check-svg-parity` compara canvas contra SVG, e os dois pipelines movem juntos
 * quando `textAlign` muda. Um gate que compara duas coisas que andam juntas mede
 * *concordância*, não *correção* — e trocar `left` por `center` na fixture passou sem
 * mudar um número.
 *
 * Então a âncora é travada aqui, no **markup emitido**, que é um valor absoluto:
 * `text-anchor="start"` e `x="30"` não são uma comparação, são a posição.
 *
 * E o `font-style` é a exceção que afixture de paridade consegue medir, porque o itálico
 * não desloca a caixa — ele inclina os glifos dentro dela, e isso produz divergência de
 * borda real entre os pipelines.
 */
const projeto = (text: Record<string, unknown>, shape = { kind: 'rectangle', width: 196, height: 44 }) => ({
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
      source: { type: 'reference' as const, path: '', shape },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      text: {
        content: 'Esquerda',
        fontFamily: 'sans-serif',
        fontSize: 22,
        fontWeight: 700,
        ...text
      },
      fill: { kind: 'solid' as const, color: '#111827' }
    }
  ]
});

/** O SVG inteiro do projeto. `skipImages` é o padrão de `renderToSvg`. */
const svgDe = (p: ReturnType<typeof projeto>): string => renderToSvg(p as never, 'default');

const textoDe = (p: ReturnType<typeof projeto>): string => /<text\b[^>]*>/.exec(svgDe(p))?.[0] ?? '';

const attr = (tag: string, nome: string): string | undefined =>
  new RegExp(`\\b${nome}="([^"]*)"`).exec(tag)?.[1];

describe('o <text> exportado', () => {
  it('left vira text-anchor="start" na borda esquerda da caixa', () => {
    // Canvas 256, shape 196 => (256-196)/2 = 30. Número absoluto, não comparação.
    const tag = textoDe(projeto({ textAlign: 'left' }));
    expect(attr(tag, 'text-anchor')).toBe('start');
    expect(Number(attr(tag, 'x'))).toBe(30);
  });

  it('right vira text-anchor="end" na borda direita', () => {
    const tag = textoDe(projeto({ textAlign: 'right' }));
    expect(attr(tag, 'text-anchor')).toBe('end');
    expect(Number(attr(tag, 'x'))).toBe(226);
  });

  it('center vira text-anchor="middle" no meio do canvas', () => {
    const tag = textoDe(projeto({ textAlign: 'center' }));
    expect(attr(tag, 'text-anchor')).toBe('middle');
    expect(Number(attr(tag, 'x'))).toBe(128);
  });

  it('ausente equivale a center — projeto salvo antes do campo', () => {
    // Todo texto que existe hoje foi salvo sem `textAlign`, e tem de continuar saindo
    // exatamente como antes.
    expect(textoDe(projeto({}))).toBe(textoDe(projeto({ textAlign: 'center' })));
  });

  it('os tres X sao distintos, e ordenados', () => {
    const xs = (['left', 'center', 'right'] as const).map((a) =>
      Number(attr(textoDe(projeto({ textAlign: a })), 'x'))
    );
    expect(new Set(xs).size).toBe(3);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('a ancora e a mesma que o canvas usa — os dois vocabularioos', () => {
    // `start` no SVG e `left` no canvas são a mesma ideia. Se um deles virar o outro
    // por engano, o texto sai do lado oposto em um dos pipelines, e a fixture de
    // paridade **não** veria — porque os dois ainda concordariam.
    const par = { start: 'left', middle: 'center', end: 'right' } as const;
    for (const [svgAnchor, canvasAlign] of Object.entries(par)) {
      const tag = ['left', 'center', 'right']
        .map((a) => projeto({ textAlign: a as 'left' | 'center' | 'right' }))
        .map(textoDe)
        .find((t) => attr(t, 'text-anchor') === svgAnchor);
      expect(tag, `nenhum <text> com text-anchor="${svgAnchor}"`).toBeDefined();
      // O nome do atributo e o do `ctx.textAlign` nao sao o mesmo por acaso: e a
      // traducao que `resolveTextPlacement` faz, e ela esta em `textLayout.ts`.
      expect(canvasAlign).toBe(svgAnchor === 'start' ? 'left' : svgAnchor === 'middle' ? 'center' : 'right');
    }
  });

  it('italic escreve font-style="italic"', () => {
    expect(attr(textoDe(projeto({ fontStyle: 'italic' })), 'font-style')).toBe('italic');
    // `oblique` é a mesma inclinação para o que este controle faz.
    expect(attr(textoDe(projeto({ fontStyle: 'oblique' })), 'font-style')).toBe('italic');
  });

  it('upright nao escreve font-style — o atributo ausente é o padrão', () => {
    // `font-style="normal"` funciona, mas ocupa bytes em todo texto exportado de um
    // projeto que não usa itálico. O padrão da SVG é `normal`.
    expect(textoDe(projeto({}))).not.toContain('font-style');
    expect(textoDe(projeto({ fontStyle: 'normal' }))).not.toContain('font-style');
  });

  it('o Y e sempre o meio, em qualquer alinhamento', () => {
    for (const a of ['left', 'center', 'right'] as const) {
      expect(Number(attr(textoDe(projeto({ textAlign: a })), 'y'))).toBe(128);
    }
  });

  it('dominant-baseline continua middle', () => {
    // O `textBaseline = 'middle'` do canvas é o par disso. Perder o atributo aqui
    // desalinharia o texto verticalmente **só no export** — que é a classe de defeito
    // que a regra do dono existe para impedir.
    expect(attr(textoDe(projeto({})), 'dominant-baseline')).toBe('middle');
  });

  it('o conteudo do texto fica **depois** da tag de abertura', () => {
    // `textoDe` devolve só a tag (`<text …>`), então o conteúdo não está nela — e o
    // teste anterior procurou `Esquerda` dentro da tag e falhou por isso, não por
    // defeito do renderer. O conteúdo é o **resto** do elemento.
    const svg = svgDe(projeto({ textAlign: 'left' }));
    expect(textoDe(projeto({ textAlign: 'left' }))).toContain('x="30"');
    expect(svg).toContain('>Esquerda</text>');
  });

  it('o conteudo do texto NAO e escapado, e isso e um defeito real', () => {
    // Este teste **reprova hoje**, e é o primeiro a medir algo que ninguém tinha
    // medido: `renderToSvg` interpola `layer.text.content` direto no markup
    // (`renderToSvg.ts:399`), sem escapar. Um logo com `AT&T` no texto gera um SVG que
    // nenhum leitor XML abre.
    //
    // Não é exagero: `&` solto é XML malformado, e `<` fecha o elemento mais cedo —
    // o texto some e o resto do documento vira lixo.
    //
    // Está registrado como **`IC63/2b`** no `NOTES.md` e corrigido no commit seguinte.
    // Fica aqui como o teste que prova a correção.
    const comEspecial = (content: string) =>
      svgDe({
        ...projeto({}),
        layers: [
          {
            ...projeto({}).layers[0],
            text: { content, fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700 }
          }
        ]
      });

    const amp = comEspecial('A & B');
    expect(amp).toContain('&amp;');
    expect(amp).not.toMatch(/>A & B/);

    const lt = comEspecial('A < B');
    expect(lt).toContain('&lt;');
    expect(lt).not.toMatch(/>A < B/);
  });
});
