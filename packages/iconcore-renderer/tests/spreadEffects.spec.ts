/**
 * Spread (Tier 2, fatia 2.0) — o contrato de markup do SVG.
 *
 * A técnica é dilatação/erosão morfológica antes do desfoque (`feMorphology`
 * antes de `feDropShadow`/`feGaussianBlur`), a mesma ordem contorno-primeiro
 * que o canvas usa (morfologia do alfa antes do `blur()`). O que estes testes
 * travam:
 *
 * - ausente ou zero emite ZERO markup novo: o filtro de um projeto antigo é
 *   byte-idêntico ao que era antes do spread existir;
 * - positivo vira `dilate`, negativo vira `erode`, com o módulo do raio;
 * - o legado `depth-shadow` nunca carrega morfologia (o param não existia);
 * - desligado emite filtro nenhum (construção do motor).
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer, LayerEffect } from '@iconcore/shared';
import { renderToSvg } from '../src/renderToSvg';

const solid = { kind: 'solid', color: '#ffffff' } as const;

const layerWith = (effects: LayerEffect[]): IconLayer => ({
  id: 'l1',
  name: 'Shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 120, height: 120 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { ...solid },
  effects
});

const projectWith = (effects: LayerEffect[]): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { ...solid } },
  layers: [layerWith(effects)],
  variants: { default: {} },
  targets: [],
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
});

const drop = (params: Record<string, number | string>): LayerEffect => ({
  kind: 'drop-shadow',
  enabled: true,
  params: { x: 0, y: 8, blur: 16, color: '#000000', opacity: 0.5, ...params }
});

const inner = (params: Record<string, number | string>): LayerEffect => ({
  kind: 'inner-shadow',
  enabled: true,
  params: { x: 0, y: 6, blur: 12, color: '#000000', opacity: 0.35, ...params }
});

describe('spread — contrato de markup', () => {
  it('drop sem spread não emite morfologia (compat byte-a-byte)', () => {
    const svg = renderToSvg(projectWith([drop({})]), 'default');
    expect(svg).not.toContain('feMorphology');
    expect(svg).toContain('<feDropShadow dx="0" dy="8" stdDeviation="8"');
    expect(svg).toContain('in="SourceGraphic"');
  });

  it('drop com spread explícito zero não emite morfologia', () => {
    const svg = renderToSvg(projectWith([drop({ spread: 0 })]), 'default');
    expect(svg).not.toContain('feMorphology');
  });

  it('drop positivo dilata o alfa e expande a sombra à mão (feDropShadow ignora `in` no rasterizador do portão)', () => {
    const svg = renderToSvg(projectWith([drop({ spread: 12 })]), 'default');
    expect(svg).toContain('<feMorphology in="SourceAlpha" operator="dilate" radius="12"');
    // A expansão manual consome o alfa morfado: blur, offset, flood, recorte.
    expect(svg).toMatch(/<feGaussianBlur stdDeviation="8" in="filter-l1-\d+-dm"/);
    expect(svg).toContain('<feOffset dx="0" dy="8"');
    expect(svg).toContain('<feFlood flood-color="#000000" flood-opacity="0.5"');
    expect(svg).toContain('operator="in"');
    expect(svg).toContain('<feMergeNode in="SourceGraphic"/>');
    expect(svg).not.toContain('feDropShadow');
  });

  it('drop negativo erode o alfa antes da sombra', () => {
    const svg = renderToSvg(projectWith([drop({ spread: -8 })]), 'default');
    expect(svg).toContain('<feMorphology in="SourceAlpha" operator="erode" radius="8"');
  });

  it('inner sem spread mantém a cadeia antiga verbatim', () => {
    const svg = renderToSvg(projectWith([inner({})]), 'default');
    expect(svg).not.toContain('feMorphology');
    expect(svg).toContain('in="SourceAlpha" result=');
  });

  it('inner inverte o sinal: positivo erode, negativo dilata (a sombra interna cresce para dentro)', () => {
    const plus = renderToSvg(projectWith([inner({ spread: 6 })]), 'default');
    expect(plus).toContain('<feMorphology in="SourceAlpha" operator="erode" radius="6"');
    expect(plus).toMatch(/<feOffset[^>]*in="filter-l1-\d+-im"/);

    const minus = renderToSvg(projectWith([inner({ spread: -6 })]), 'default');
    expect(minus).toContain('<feMorphology in="SourceAlpha" operator="dilate" radius="6"');
  });

  it('legado depth-shadow nunca carrega morfologia', () => {
    const svg = renderToSvg(
      projectWith([
        { kind: 'depth-shadow', enabled: true, params: { x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.3)' } }
      ]),
      'default'
    );
    expect(svg).toContain('<feDropShadow');
    expect(svg).not.toContain('feMorphology');
  });

  it('efeito desligado com spread emite markup zero', () => {
    const svg = renderToSvg(
      projectWith([{ ...drop({ spread: 12 }), enabled: false }]),
      'default'
    );
    expect(svg).not.toContain('<filter');
    expect(svg).not.toContain('feMorphology');
  });
});
