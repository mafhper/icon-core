import { describe, expect, it } from 'vitest';
import { auditProject } from '../src';
import type { IconCoreProject, IconTarget, IconLayer } from '@iconcore/shared';

/**
 * O aviso `TEXT_FONT_NOT_EMBEDDED`: texto + SVG + uma fonte que o SVG nao carrega.
 *
 * ## O que o aviso afirma, e o que ele nao afirma
 *
 * O `renderToSvg` emite `<text font-family="...">`, e um SVG carrega o **nome** da familia,
 * nao o arquivo. Entao:
 *
 * - `Inter, system-ui, sans-serif` **renderiza** em qualquer maquina — o `system-ui` e o
 *   fallback garantido. Dizer que ali "sai um Times" seria **falso**.
 * - O que muda e **qual** cara aparece: o texto quebra diferente da que a pessoa ajustou.
 *
 * E o aviso e sobre isso. Os testes abaixo medem as duas metades separadamente, porque a
 * primeira versao da funcao de suporte decidia pela primeira familia e produzia o segundo
 * caso com o texto do primeiro.
 *
 * ## As duas condicoes, e por que as duas
 *
 * 1. **O projeto exporta SVG?** Nao: PNG, ICO e Tauri sao rasterizados no agente de usuario e
 *    o texto sai correto. Avisar sobre um formato que a pessoa nao exporta e ruido — e um
 *    aviso que aparece sempre treina a pessoa a ignorar.
 * 2. **A fonte e concreta?** Nao: uma familia generica nao depende de nenhum arquivo.
 */

const alvo = (target: IconTarget, enabled = true) => ({ target, enabled });

const camadaDeTexto = (fontFamily: string): IconLayer =>
  ({
    id: 'texto',
    name: 'Wordmark',
    kind: 'text',
    visible: true,
    zIndex: 0,
    source: { type: 'reference', path: '' },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    text: { content: 'Hi', fontFamily, fontSize: 64, fontWeight: 700 }
  }) as unknown as IconLayer;

const projeto = (targets: IconTarget[], fontFamily = "'Cal Sans', system-ui, sans-serif") =>
  ({
    schemaVersion: 3,
    metadata: { name: 'App', shortName: 'App' },
    canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
    variants: { default: {} },
    layers: [camadaDeTexto(fontFamily)],
    targets: targets.map((t) => alvo(t)),
    exportProfile: { outputBaseName: 'app', quality: 0.95, generateReport: false }
  }) as unknown as IconCoreProject;

const temAviso = (p: IconCoreProject, code: string) =>
  auditProject(p).issues.some((i) => i.code === code);

describe('TEXT_FONT_NOT_EMBEDDED', () => {
  it('aparece quando o projeto exporta SVG e a fonte e concreta', () => {
    expect(temAviso(projeto(['web-favicon']), 'TEXT_FONT_NOT_EMBEDDED')).toBe(true);
    expect(temAviso(projeto(['electron']), 'TEXT_FONT_NOT_EMBEDDED')).toBe(true);
  });

  it('NÃO aparece para um alvo so raster', () => {
    // O alcance do problema e o SVG. PNG, ICO e Tauri sao rasterizados no agente de usuario
    // e ficam corretos, entao o aviso la seria ruido.
    for (const target of ['pwa', 'tauri', 'desktop-generic', 'marketing'] as const) {
      expect(temAviso(projeto([target]), 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);
    }
  });

  it('NÃO aparece quando o alvo SVG esta desabilitado', () => {
    const p = {
      ...projeto(['web-favicon']),
      targets: [alvo('web-favicon', false), alvo('pwa', true)]
    } as IconCoreProject;
    expect(temAviso(p, 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);
  });

  it('NÃO aparece com uma familia generica na primeira posicao', () => {
    expect(temAviso(projeto(['web-favicon'], 'system-ui, sans-serif'), 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);
    expect(temAviso(projeto(['web-favicon'], 'monospace'), 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);
  });

  it('NÃO aparece sem camada de texto visivel', () => {
    const base = projeto(['web-favicon']);
    const sem = { ...base, layers: [] } as IconCoreProject;
    expect(temAviso(sem, 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);

    const oculta = {
      ...base,
      layers: [{ ...camadaDeTexto('Inter'), visible: false }]
    } as IconCoreProject;
    expect(temAviso(oculta, 'TEXT_FONT_NOT_EMBEDDED')).toBe(false);
  });

  it('a fonte e concreta COM fallback generico: avisa, e nao diz "sai um Times"', () => {
    // A distincao que a primeira versao apagou. Esta pilha renderiza em qualquer maquina;
    // o que muda e a cara. Um aviso que dissesse "sera substituido" sem qualifier seria
    // verdadeiro em espirito e enganoso no detalhe — e a pessoa precisaria abrir o SVG para
    // descobrir que o texto nao some.
    const p = projeto(['web-favicon'], "'Cal Sans', system-ui, sans-serif");
    const aviso = auditProject(p).issues.find((i) => i.code === 'TEXT_FONT_NOT_EMBEDDED');
    expect(aviso).toBeDefined();
    expect(aviso!.message).toMatch(/falls back/i);
    expect(aviso!.message).not.toMatch(/will not render|no text/i);
  });

  it('e um aviso, nunca um erro', () => {
    // Erro bloqueia o export. O SVG sai, so que em outra fonte — e quem decide se isso
    // importa e a pessoa, nao o validador.
    const aviso = auditProject(projeto(['web-favicon'])).issues.find(
      (i) => i.code === 'TEXT_FONT_NOT_EMBEDDED'
    );
    expect(aviso!.severity).toBe('warning');
  });

  it('nao some o AVOID_TEXT: sao duas perguntas diferentes', () => {
    // Uma e "Apple recomenda evitar texto"; a outra e "esse texto depende da sua maquina".
    // Colapsar as duas perderia um aviso que ja existia.
    const codes = auditProject(projeto(['web-favicon'])).issues.map((i) => i.code);
    expect(codes).toContain('AVOID_TEXT');
    expect(codes).toContain('TEXT_FONT_NOT_EMBEDDED');
  });

  it('o aviso aponta a camada', () => {
    const aviso = auditProject(projeto(['web-favicon'])).issues.find(
      (i) => i.code === 'TEXT_FONT_NOT_EMBEDDED'
    );
    expect(aviso!.layerId).toBe('texto');
  });
});
