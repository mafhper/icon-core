/**
 * Glass v1 (Tier 2, fatia 2.2) — o contrato de markup do SVG.
 *
 * Um kind, cinco params exatos (tint/tintOpacity/blurRadius/edgeHighlight/
 * frost), zero física nova: blur-behind da 2.1, coat chapado, stroke interno
 * branco e `feTurbulence` de seed fixa (primo vetorial do tile da 2.3). Trava:
 *
 * - ausente/desligado/tudo-zero emite ZERO markup;
 * - ligado emite as quatro coats em ordem (blur, tint, edge, frost) dentro
 *   de UM grupo com o transform da camada;
 * - o abaixo aparece de novo (borrado), como na 2.1.
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { renderToSvgWithOptions } from '../src/renderToSvg';

const glass = (params: Record<string, number | string>) => ({
  kind: 'glass' as const,
  enabled: true,
  params: {
    tint: '#ffffff',
    tintOpacity: 0.2,
    blurRadius: 14,
    edgeHighlight: 0.6,
    frost: 0.25,
    ...params
  }
});

const fundo = (id: string, dx: number, color: string): IconLayer => ({
  id,
  name: 'fundo',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 128, height: 256 } },
  transform: { x: dx, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color }
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
  // Sem fill próprio: o vidro é as coats, não uma pintura — e é assim que a
  // fixture de paridade o usa (o `fill: none` não pode engolir o efeito).
  fill: { kind: 'none' },
  effects
});

const projectWith = (effects: IconLayer['effects']): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
  layers: [fundo('l1', -64, '#d32f2f'), fundo('l2', 64, '#1565c0'), vidro(effects)],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
});

describe('glass — contrato de markup', () => {
  it('sem o efeito não emite nada com o nome glass', () => {
    const { svg } = renderToSvgWithOptions(projectWith([]), 'default');
    expect(svg).not.toContain('glass');
  });

  it('desligado ou com tudo zerado emite markup zero', () => {
    const off = renderToSvgWithOptions(
      projectWith([{ ...glass({}), enabled: false }]),
      'default'
    ).svg;
    expect(off).not.toContain('glass');

    const zero = renderToSvgWithOptions(
      projectWith([glass({ tintOpacity: 0, blurRadius: 0, edgeHighlight: 0, frost: 0 })]),
      'default'
    ).svg;
    expect(zero).not.toContain('glass');
  });

  it('ligado emite as quatro coats em ordem dentro de um grupo', () => {
    const { svg, warnings } = renderToSvgWithOptions(projectWith([glass({})]), 'default');
    expect(warnings).toEqual([]);

    // Ordem medida nos USOS dentro do grupo (os defs moram no <defs>, antes
    // de tudo — indexar o primitivo mede o bloco errado).
    const blur = svg.indexOf('filter="url(#glass-blur-');
    const tint = svg.indexOf('fill="rgba(255, 255, 255, 0.2)"');
    const edge = svg.indexOf('stroke-width="6"');
    const frost = svg.indexOf('filter="url(#glass-noise-');
    expect(blur).toBeGreaterThan(-1);
    expect(tint).toBeGreaterThan(-1);
    expect(edge).toBeGreaterThan(-1);
    expect(frost).toBeGreaterThan(-1);
    expect(blur).toBeLessThan(tint);
    expect(tint).toBeLessThan(edge);
    expect(edge).toBeLessThan(frost);
    // Os defs existem: blur 1:1 com o raio, turbulência de seed fixa.
    expect(svg).toContain('<feGaussianBlur stdDeviation="14"/>');
    expect(svg).toContain('<feTurbulence type="fractalNoise"');
    expect(svg).toContain('seed="7"');
    // O abaixo re-emitido (o vermelho de trás aparece de novo, borrado).
    expect(svg.match(/rgb\(211, 47, 47\)/g)!.length).toBeGreaterThanOrEqual(2);
    // Seed fixa na turbulência: determinístico por construção.
    expect(svg).toContain('seed="7"');
  });

  it('cada coat desligado some sem levar as outras', () => {
    const { svg } = renderToSvgWithOptions(
      projectWith([glass({ tintOpacity: 0, edgeHighlight: 0, frost: 0 })]),
      'default'
    );
    expect(svg).toContain('<feGaussianBlur stdDeviation="14"/>');
    expect(svg).not.toContain('rgba(255, 255, 255,');
    expect(svg).not.toContain('stroke-width="6"');
    expect(svg).not.toContain('feTurbulence');
  });
});
