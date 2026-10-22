/**
 * Tier 2 (2.4) — validador e compatibilidade.
 *
 * Medição primeiro: o validador NÃO restringe kinds de efeito — não há
 * nenhuma checagem sobre `layer.effects` em `src/index.ts` (só metadados,
 * camadas, contraste, safe area, traço e texto). Então "aceitar os novos"
 * é travar que continua assim: um projeto carregado de efeitos Tier 2
 * (spread ±, backdrop-blur, glass, noise-grain, bloom) mais o legado depth-shadow
 * audita EXATAMENTE igual ao mesmo projeto sem efeito nenhum. Se um dia um
 * check passar a olhar kinds, este teste diz quais issues novas ele criou.
 */
import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconLayer, LayerEffect } from '@iconcore/shared';
import { auditProject } from '../src/index';

const camada = (effects: LayerEffect[]): IconLayer => ({
  id: 'l',
  name: 'Camada',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rounded-rectangle', width: 200, height: 200, cornerRadius: 32 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#1565c0' },
  effects
});

const projeto = (effects: LayerEffect[]): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'p', shortName: 'p' },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
  layers: [camada(effects)],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
});

const TODOS: LayerEffect[] = [
  { kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' } },
  { kind: 'drop-shadow', enabled: true, params: { x: 0, y: 8, blur: 16, spread: 12, color: '#000000', opacity: 0.5 } },
  { kind: 'inner-shadow', enabled: true, params: { x: 0, y: 6, blur: 12, spread: -6, color: '#000000', opacity: 0.35 } },
  { kind: 'backdrop-blur', enabled: true, params: { radius: 14 } },
  {
    kind: 'glass',
    enabled: true,
    params: { tint: '#ffffff', tintOpacity: 0.2, blurRadius: 14, edgeHighlight: 0.6, frost: 0.25 }
  },
  { kind: 'noise-grain', enabled: true, params: { amount: 0.5, size: 2, monochrome: true } },
  { kind: 'surface-blur', enabled: true, params: { radius: 8 } },
  { kind: 'bloom', enabled: true, params: { color: '#66aaff', opacity: 0.9, blur: 18, intensity: 2 } }
];

describe('Tier 2 (2.4) — o validador não restringe kinds de efeito', () => {
  it('projeto com todos os efeitos audita igual ao projeto sem nenhum', () => {
    const com = auditProject(projeto(TODOS));
    const sem = auditProject(projeto([]));
    expect(com).toEqual(sem);
  });

  it('cada kind novo, sozinho, não cria issue', () => {
    const base = auditProject(projeto([]));
    for (const effect of TODOS) {
      expect(auditProject(projeto([effect]))).toEqual(base);
    }
  });
});
