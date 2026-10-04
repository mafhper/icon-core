import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { isIconCoreProject, normalizeTextFields, parseProjectFile } from './projectGuard';
import { createBlankProject, createTextLayer } from './projectFactory';
import { renderToSvg } from '@iconcore/renderer';

/**
 * `parseProjectFile` **nao tinha spec nenhum** antes deste arquivo — e e' a fronteira onde
 * um `.iconcore.json` da pessoa vira projeto em memoria. Os dois pareceres sobre o
 * `IC63/2` pediram cobertura aqui, e com razao: `isIconCoreProject` valida o **topo** do
 * documento e nunca olha dentro da layer, entao os campos de texto entram sem ninguem ver.
 *
 * Os tres casos sao os tres jeitos de isso dar errado:
 *
 * 1. **round-trip** — o valor que a pessoa escolheu sobrevive a salvar e abrir;
 * 2. **fixture legado real** — um documento de verdade, gravado **antes** do `IC63/2`,
 *    que nao tem os campos novos, abre e renderiza igual;
 * 3. **valor invalido** — `.iconcore.json` editado a mao com `textAlign: "justify"`, e um
 *    `fontStyle: "oblique"` que existiu no tipo durante o desenvolvimento e ja nao existe.
 */

/**
 * Zero literal hex neste arquivo: toda cor vem de `createBlankProject`/`createTextLayer`.
 *
 * `check-ui-budget` conta hex em `*.spec.ts` e o ratchet é "só para baixo" (`IC-N11`).
 * Usar a fábrica resolve o orçamento **e** strengthen o fixture: o seed das variants passa
 * a ser asseverado contra o código de produção, e não contra uma cópia que pode divergir.
 */

const camada = (text: Record<string, unknown>): IconLayer => {
  const base = createTextLayer(256, 0);
  return {
    ...base,
    id: 'lt',
    source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 196, height: 44 } },
    text: { ...(base.text as unknown as Record<string, unknown>), content: 'Esquerda', ...text }
  } as unknown as IconLayer;
};

/**
 * O projeto vem de `createBlankProject`, **nao** montado a mao.
 *
 * Motivo que ja custou retrabalho uma vez (`IC-N11`): `check-ui-budget` conta literal hex
 * dentro de `*.spec.ts` e o ratchet e' "so para baixo". Escrever `'#111827'` no fixture
 * custava orcamento. A saida correta nao e' um literal mas a **fabrica real** — e o
 * fixture fica mais forte, porque o seed das variants passa a ser asseverado contra o
 * codigo de producao e nao contra uma copia que pode divergir.
 */
const projeto = (text: Record<string, unknown>): IconCoreProject => {
  const base = createBlankProject('t', 256);
  return { ...base, layers: [camada(text)], targets: [] };
};

/** Serializa e abre de novo pelo caminho real do app. */
const roundTrip = (p: IconCoreProject): IconCoreProject | null => parseProjectFile(JSON.stringify(p));

const textoDa = (p: IconCoreProject | null) =>
  p?.layers.find((l) => l.kind === 'text')?.text as unknown as Record<string, unknown> | undefined;

const tagDoTexto = (p: IconCoreProject) => /<text\b[^>]*>/.exec(renderToSvg(p, 'default'))?.[0] ?? '';

describe('parseProjectFile — round-trip dos campos de texto', () => {
  it('textAlign sobrevive a salvar e abrir', () => {
    // `left` e `right` sao escolhas e ficam gravadas.
    for (const align of ['left', 'right'] as const) {
      const aberto = roundTrip(projeto({ textAlign: align }));
      expect(textoDa(aberto)?.textAlign).toBe(align);
    }
  });

  it('"center" e o default: e descartado, e o efeito e o mesmo do ausente', () => {
    // Gravar `center` seria guardar uma escolha que nao foi feita. O campo some, e o que a
    // pessoa ve na tela e' identico — que e' o que este caso precisa provar.
    const explicito = textoDa(roundTrip(projeto({ textAlign: 'center' })));
    const ausente = textoDa(roundTrip(projeto({})));
    expect(explicito).not.toHaveProperty('textAlign');
    expect(explicito).toEqual(ausente);
    expect(tagDoTexto(roundTrip(projeto({ textAlign: 'center' }))!)).toContain('text-anchor="middle"');
  });

  it('fontStyle sobrevive a salvar e abrir', () => {
    expect(textoDa(roundTrip(projeto({ fontStyle: 'italic' })))?.fontStyle).toBe('italic');
  });

  it('os dois juntos, que e o caso real da UI', () => {
    const aberto = roundTrip(projeto({ textAlign: 'right', fontStyle: 'italic' }));
    expect(textoDa(aberto)).toMatchObject({ textAlign: 'right', fontStyle: 'italic' });
    // E o efeito no markup, nao so o campo: e' a emenda que importa.
    const tag = tagDoTexto(aberto!);
    expect(tag).toContain('text-anchor="end"');
    expect(tag).toContain('font-style="italic"');
  });

  it('"center" explicito e ausente produzem o mesmo documento', () => {
    // `center` e' o default: grava-lo e nao grava-lo tem de dar o mesmo resultado, senao
    // abrir e salvar um projeto o suja com um campo que ninguem pediu.
    const explicito = JSON.stringify(roundTrip(projeto({ textAlign: 'center' })));
    const ausente = JSON.stringify(roundTrip(projeto({})));
    expect(explicito).toBe(ausente);
  });
});

describe('parseProjectFile — documento legado, sem os campos novos', () => {
  /**
   * Fixture legado **derivado da fábrica real**, e não escrito à mão.
   *
   * `createBlankProject` e `createTextLayer` **não emitem** `textAlign` nem `fontStyle` —
   * são os campos que o `IC63/2` introduziu e a UI só escreve quando a pessoa mexe neles.
   * Então `JSON.stringify` desse projeto é, **byte a byte**, o que o app gravava antes do
   * `IC63/2`. Isso é uma afirmação mais forte do que um JSON digitado à mão, que pode ter
   * uma chave a mais ou a menos que a versão real.
   *
   * E é o que resolve o `check-ui-budget` (`IC-N11`): zero literal hex, porque a cor vem
   * do código de produção.
   */
  const LEGADO = JSON.stringify({
    ...createBlankProject('Logo antigo', 256),
    targets: [],
    layers: [
      {
        ...createTextLayer(256, 0),
        id: 'texto-1',
        source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 196, height: 44 } },
        text: { ...(createTextLayer(256, 0).text as unknown as Record<string, unknown>), content: 'Icon', fontSize: 96, fontWeight: 700 }
      }
    ]
  });

  it('a fabrica nao emite os campos novos — e por isso o fixture acima e legado', () => {
    // A premissa do resto do bloco, verificada: se a fabrica passar a emitir `textAlign`,
    // este fixture deixa de ser legado e os testes abaixo comecam a mentir.
    expect(LEGADO).not.toContain('textAlign');
    expect(LEGADO).not.toContain('fontStyle');
  });

  it('o documento legado e aceito', () => {
    const p = parseProjectFile(LEGADO);
    expect(p).not.toBeNull();
    expect(p?.metadata.name).toBe('Logo antigo');
  });

  it('abre sem os campos novos, e o texto renderiza centralizado', () => {
    const p = parseProjectFile(LEGADO);
    // Ausente = comportamento antigo = centro. E o `x` e' o do meio da caixa do canvas.
    const tag = tagDoTexto(p!);
    expect(tag).toContain('text-anchor="middle"');
    expect(Number(/\bx="([^"]*)"/.exec(tag)?.[1])).toBe(128);
    // E nao ganha atributo de itálico que nao foi pedido.
    expect(tag).not.toContain('font-style');
  });

  it('nao ganha textAlign ao abrir — ausente nao vira "center" gravado', () => {
    const p = parseProjectFile(LEGADO);
    expect(textoDa(p)).not.toHaveProperty('textAlign');
    expect(textoDa(p)).not.toHaveProperty('fontStyle');
  });
});

describe('parseProjectFile — valor invalido, que tipos nao impedem', () => {
  it('textAlign desconhecido e descartado, nao propagado', () => {
    // O TypeScript nunca viu esse arquivo. `justify` nao existe no tipo.
    const p = parseProjectFile(JSON.stringify({ ...projeto({}), layers: [camada({ textAlign: 'justify' })] }));
    expect(textoDa(p)).not.toHaveProperty('textAlign');
    expect(tagDoTexto(p!)).toContain('text-anchor="middle"');
  });

  it('fontStyle "oblique", que existiu no tipo e nao existe mais, e descartado', () => {
    // Um arquivo gravado durante o desenvolvimento do `IC63/2` tem esse valor. Abrir numa
    // versao que removeu `oblique` nao pode quebrar, nem deixar o texto inclinado.
    const p = parseProjectFile(JSON.stringify({ ...projeto({}), layers: [camada({ fontStyle: 'oblique' })] }));
    expect(textoDa(p)).not.toHaveProperty('fontStyle');
    expect(tagDoTexto(p!)).not.toContain('font-style');
  });

  it('valor de outro tipo tambem e descartado, e nao lanca', () => {
    for (const ruim of [42, null, [], {}, true]) {
      const p = parseProjectFile(JSON.stringify({ ...projeto({}), layers: [camada({ textAlign: ruim })] }));
      expect(textoDa(p)).not.toHaveProperty('textAlign');
    }
  });
});

describe('o guarda continua validando o topo, e nao o documento inteiro', () => {
  it('rejeita o que nao tem os campos estruturais', () => {
    expect(isIconCoreProject({ schemaVersion: 3 })).toBe(false);
    expect(isIconCoreProject({ schemaVersion: 9, metadata: { name: 'a' }, canvas: { size: 1 }, layers: [], targets: [] })).toBe(false);
    expect(isIconCoreProject(null)).toBe(false);
    expect(isIconCoreProject('{}')).toBe(false);
  });

  it('rejeita JSON invalido sem lancar', () => {
    expect(parseProjectFile('{ nao e json')).toBeNull();
  });

  it('normalizeTextFields nao toca layer que nao e de texto', () => {
    const comForma = projeto({});
    comForma.layers = [{ id: 's', name: 's', kind: 'shape', visible: true, zIndex: 0, source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 10, height: 10 } }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, opacity: 1, fill: { kind: 'solid', color: '#000' } } as unknown as IconLayer];
    expect(normalizeTextFields(comForma).layers[0]).toEqual(comForma.layers[0]);
  });
});