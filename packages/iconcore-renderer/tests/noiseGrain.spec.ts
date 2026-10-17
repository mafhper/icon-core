/**
 * Noise grain (Tier 2, fatia 2.3) — o contrato de markup do SVG.
 *
 * Reaviva o kind morto `noise-grain` com amount/size/monochrome: turbulência
 * fractal de seed fixa sobre a pintura da camada, recortada no footprint.
 * Trava:
 *
 * - ausente/desligado/amount zero emite ZERO markup;
 * - ligado emite `feTurbulence` (seed fixa) + clip no footprint;
 * - monocromático dessatura, colorido não;
 * - tamanho do grão mapeia inversamente na frequência.
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

const grain = (params: Record<string, number | boolean>) => ({
  kind: 'noise-grain' as const,
  enabled: true,
  params: { amount: 0.5, size: 2, monochrome: true, ...params }
});

const layerWith = (effects: IconLayer['effects']): IconLayer => ({
  id: 'lgrao',
  name: 'grao',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 160, height: 160 } },
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

describe('noise-grain — contrato de markup', () => {
  it('sem o efeito não emite nada com o nome noise', () => {
    const { svg } = renderToSvgWithOptions(projectWith([]), 'default');
    expect(svg).not.toContain('noise');
  });

  it('desligado ou com amount zero emite markup zero', () => {
    for (const effects of [[{ ...grain({}), enabled: false }], [grain({ amount: 0 })]]) {
      const { svg } = renderToSvgWithOptions(projectWith(effects), 'default');
      expect(svg).not.toContain('noise');
      expect(svg).not.toContain('feTurbulence');
    }
  });

  it('ligado emite turbulência de seed fixa recortada no footprint', () => {
    const { svg, warnings } = renderToSvgWithOptions(projectWith([grain({})]), 'default');
    expect(warnings).toEqual([]);
    expect(svg).toContain('<feTurbulence type="fractalNoise"');
    expect(svg).toContain('seed="3"');
    expect(svg).toContain('clip-path="url(#noise-clip-lgrao-');
    // Tamanho 2 → frequência 0.45.
    expect(svg).toContain('baseFrequency="0.450"');
    // Amount 0.5 com pico 0.7 → opacidade 0.35.
    expect(svg).toContain('opacity="0.3500"');
  });

  it('monocromático dessatura, colorido preserva os canais', () => {
    const mono = renderToSvgWithOptions(projectWith([grain({ monochrome: true })]), 'default').svg;
    expect(mono).toContain('<feColorMatrix type="saturate" values="0"/>');

    const color = renderToSvgWithOptions(projectWith([grain({ monochrome: false })]), 'default').svg;
    expect(color).toContain('feTurbulence');
    expect(color).not.toContain('saturate');
  });

  it('grão maior baixa a frequência', () => {
    const { svg } = renderToSvgWithOptions(projectWith([grain({ size: 4 })]), 'default');
    expect(svg).toContain('baseFrequency="0.225"');
  });
});
