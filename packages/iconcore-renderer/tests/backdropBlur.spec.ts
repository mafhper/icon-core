/**
 * Background blur (Tier 2, fatia 2.1) — o contrato de markup do SVG.
 *
 * Estratégia decidida no spike da fatia (ver o bloco backdrop em
 * `renderToSvg.ts`): re-emitir a pilha-abaixo borrada e recortada para o
 * footprint — markup puro, determinístico, sem rasterização síncrona
 * impossível e sem aposta em `backdrop-filter`. O que estes testes travam:
 *
 * - ausente/desligado/raio zero emite ZERO markup (desligado = zero);
 * - ligado re-emite o abaixo (o fill de trás aparece duas vezes), com
 *   `clipPath` no footprint e `feGaussianBlur` 1:1 com o raio (NÃO /2 —
 *   ver a prova de kernel em `.dev/tmp/fx2-kernel-proof.mjs`);
 * - o recorte acompanha o transform da camada, não o conteúdo de baixo.
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

const backdrop = (radius: number, enabled = true) => ({
  kind: 'backdrop-blur' as const,
  enabled,
  params: { radius }
});

const fundo = (): IconLayer => ({
  id: 'lfundo',
  name: 'fundo',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 256, height: 256 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#d32f2f' }
});

const vidro = (effects: IconLayer['effects']): IconLayer => ({
  id: 'lvidro',
  name: 'vidro',
  kind: 'shape',
  visible: true,
  zIndex: 1,
  source: { type: 'reference', path: '', shape: { kind: 'rounded-rectangle', width: 144, height: 144, cornerRadius: 24 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#ffffff' },
  effects
});

const projectWith = (top: IconLayer): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
  layers: [fundo(), top],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
});

describe('backdrop-blur — contrato de markup', () => {
  it('sem o efeito não emite nada com o nome backdrop', () => {
    const { svg } = renderToSvgWithOptions(projectWith(vidro([])), 'default');
    expect(svg).not.toContain('backdrop');
  });

  it('desligado ou com raio zero emite markup zero', () => {
    for (const effects of [[backdrop(12, false)], [backdrop(0)]]) {
      const { svg } = renderToSvgWithOptions(projectWith(vidro(effects)), 'default');
      expect(svg).not.toContain('backdrop');
    }
  });

  it('ligado re-emite o abaixo borrado e recortado no footprint', () => {
    const { svg, warnings } = renderToSvgWithOptions(projectWith(vidro([backdrop(12)])), 'default');
    expect(warnings).toEqual([]);
    // O fill vermelho de trás aparece duas vezes: no próprio e no grupo borrado.
    expect(svg.match(/rgb\(211, 47, 47\)/g)!.length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('<clipPath id="backdrop-clip-lvidro-');
    expect(svg).toContain('<feGaussianBlur stdDeviation="12"/>');
    // O grupo vem ANTES da pintura da camada.
    expect(svg.indexOf('backdrop-clip-lvidro-')).toBeLessThan(svg.indexOf('fill="rgb(255, 255, 255)"'));
  });

  it('o recorte acompanha o transform da camada', () => {
    const top = vidro([backdrop(12)]);
    top.transform = { x: 30, y: -20, scale: 1, rotation: 0 };
    const { svg } = renderToSvgWithOptions(projectWith(top), 'default');
    expect(svg).toContain('<g transform="translate(158,108) rotate(0) scale(1) translate(-128,-128)">');
  });

  it('camada sem forma e sem tamanho avisa em vez de borrar o canvas inteiro em silêncio', () => {
    const top: IconLayer = {
      ...vidro([backdrop(12)]),
      source: { type: 'inline', mimeType: 'image/png', data: '' }
    };
    const { warnings } = renderToSvgWithOptions(projectWith(top), 'default', { skipImages: true });
    expect(warnings.some((w) => w.includes('backdrop blur'))).toBe(true);
  });
});
