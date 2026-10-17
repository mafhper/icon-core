/**
 * Bloom (Tier 3, fatia 3) — o contrato nas duas pipelines.
 *
 * Kind novo aditivo: `bloom` empilha coats de drop-shadow com offset zero
 * (o glow intenso) — no canvas via coats manuais (`blur()` + flood
 * `source-in`, recursivos como a cadeia; o `drop-shadow()` verbatim pinta
 * mas tem caudas mais gordas e dois coats já divergem 19,4%), no SVG via
 * `feDropShadow` encadeados. Trava:
 *
 * - ausente/desligado/blur zero/intensidade zero emite ZERO markup e ZERO
 *   filtro de canvas (projeto sem bloom sai byte-idêntico);
 * - ligado emite N `feDropShadow` encadeados (N = intensidade) com os números
 *   exatos, depois do drop e antes do blur;
 * - o CSS do canvas carrega os mesmos números (cor, blur, coats).
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { bloomActive, bloomBlurPx, bloomFlood, bloomIntensity } from '../src/composeLayers';
import { renderToSvgWithOptions } from '../src/renderToSvg';

const bloom = (params: Record<string, number | string>) => ({
  kind: 'bloom' as const,
  enabled: true,
  params: { color: '#66aaff', opacity: 0.9, blur: 18, intensity: 2, ...params }
});

const layerWith = (effects: IconLayer['effects']): IconLayer => ({
  id: 'lflor',
  name: 'flor',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rounded-rectangle', width: 176, height: 176, cornerRadius: 32 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#1565c0' },
  effects
});

const projectWith = (effects: IconLayer['effects']): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
  layers: [layerWith(effects)],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
});

describe('bloom — contrato de markup (SVG)', () => {
  it('sem o efeito não emite filtro nenhum', () => {
    const { svg } = renderToSvgWithOptions(projectWith([]), 'default');
    expect(svg).not.toContain('<filter');
  });

  it('desligado, com blur zero ou sem coats emite markup zero', () => {
    for (const effects of [
      [{ ...bloom({}), enabled: false }],
      [bloom({ blur: 0 })],
      [bloom({ intensity: 0 })]
    ]) {
      const { svg } = renderToSvgWithOptions(projectWith(effects), 'default');
      expect(svg).not.toContain('<filter');
      expect(svg).not.toContain('feDropShadow');
    }
  });

  it('ligado emite os coats encadeados com os números exatos', () => {
    const { svg, warnings } = renderToSvgWithOptions(projectWith([bloom({})]), 'default');
    expect(warnings).toEqual([]);
    // Intensidade 2 = dois coats; blur 18 vira stdDeviation 9 (o mesmo
    // mapeamento do ramo drop: um número, uma suavidade).
    const coats = svg.match(/<feDropShadow[^>]*stdDeviation="9"[^>]*>/g);
    expect(coats).toHaveLength(2);
    expect(svg).toContain('flood-color="#66aaff"');
    expect(svg).toContain('flood-opacity="0.9"');
    // Encadeados: o segundo coat bebe do primeiro (o prefixo do id do
    // filtro varia com a sequência do documento; o sufixo é o contrato).
    const primeiro = svg.match(/result="([^"]+)-b0"/);
    expect(primeiro).toBeTruthy();
    expect(svg).toContain(`in="${primeiro![1]}-b0"`);
    expect(svg).toContain(`result="${primeiro![1]}-b1"`);
    expect(svg).toContain('dx="0"');
    expect(svg).toContain('dy="0"');
  });

  it('a intensidade manda no número de coats', () => {
    const { svg } = renderToSvgWithOptions(projectWith([bloom({ intensity: 3 })]), 'default');
    expect(svg.match(/<feDropShadow[^>]*>/g)).toHaveLength(3);
  });

  it('compõe depois do drop: os dois marcam presença', () => {
    const { svg } = renderToSvgWithOptions(
      projectWith([
        { kind: 'drop-shadow', enabled: true, params: { x: 0, y: 8, blur: 16, color: '#000000', opacity: 0.5 } },
        bloom({})
      ]),
      'default'
    );
    expect(svg).toContain('dy="8"');
    expect(svg).toContain('stdDeviation="9"');
  });
});

describe('bloom — portas de ativação (canvas)', () => {
  // A pintura dos coats exige browser (está na prova `.dev/tmp/fx3-bloom.*`):
  // aqui ficam as portas puras que decidem se o passe acontece.
  it('inativo quando ausente, desligado, sem blur ou sem coats', () => {
    expect(bloomActive(undefined)).toBe(false);
    expect(bloomActive({ ...bloom({}), enabled: false })).toBe(false);
    expect(bloomActive(bloom({ blur: 0 }))).toBe(false);
    expect(bloomActive(bloom({ intensity: 0 }))).toBe(false);
    expect(bloomActive(bloom({}))).toBe(true);
  });

  it('a intensidade manda nos coats e é tetada', () => {
    expect(bloomIntensity(bloom({ intensity: 1 }))).toBe(1);
    expect(bloomIntensity(bloom({ intensity: 3 }))).toBe(3);
    expect(bloomIntensity(bloom({ intensity: 99 }))).toBe(5);
  });

  it('blur e flood carregam os mesmos números do SVG', () => {
    expect(bloomBlurPx(bloom({}))).toBe(9);
    expect(bloomFlood(bloom({}))).toBe('rgba(102, 170, 255, 0.9)');
  });
});
