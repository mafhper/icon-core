import { describe, expect, it } from 'vitest';
import { SVG_EMITTING_TARGETS } from '@iconcore/shared';
import type { IconCoreProject, IconTarget } from '@iconcore/shared';
import { getAllPresets } from '../src/presets';
import { PRESET_ID_BY_TARGET } from '../src/presets/registry';

/**
 * Amarra `SVG_EMITTING_TARGETS` ao preset registry.
 *
 * ## O que este arquivo existe para impedir
 *
 * O validador precisa avisar que uma camada de texto num icone exportado como **SVG** carrega
 * o *nome* da fonte, e nao a fonte. Para isso ele precisa saber quais alvos emitem SVG — e ele
 * **nao pode** importar de `@iconcore/exporters`, porque exporters ja depende do validador e
 * seria um ciclo.
 *
 * A solucao foi declarar a lista no `shared`. Isso cria uma **copia**, e uma copia sem teste e
 * exatamente a divergencia silenciosa que `assets/brand/` veio eliminar: dois arquivos que
 * existem e que ninguem compara.
 *
 * Entao este arquivo e a comparacao. E ele mede por **`createArtifacts`**, nao por uma lista
 * estatica: o preset expoe uma funcao, e uma verificacao sobre uma lista reescrita a mao
 * seria a verificacao de uma copia da copia.
 *
 * ## Por que os dois lados podem divergir sem ninguem ver
 *
 * O aviso so aparece para quem exporta SVG. Se a lista ganhasse um alvo a mais, o aviso
 * apareceria para quem exporta PNG — e ninguem nota um aviso a mais. Se perdesse, o aviso
 * sumiria para quem exporta SVG — e ninguem nota um aviso a menos, ate a release sair com a
 * fonte errada. Os dois erros passam o CI silenciosamente, e so um dos dois e visivel no uso.
 */

/** Um projeto minimo: o preset so precisa de `canvas` e `variants` para listar artefatos. */
const projeto = (): IconCoreProject =>
  ({
    schemaVersion: 3,
    metadata: { name: 'App', shortName: 'App' },
    canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
    variants: { default: {} },
    layers: [],
    targets: [],
    exportProfile: { outputBaseName: 'app', quality: 0.95, generateReport: false }
  }) as unknown as IconCoreProject;

const contexto = () => ({ project: projeto(), variants: ['default' as const] });

const presetDoTarget = (target: IconTarget) => {
  const presetId = PRESET_ID_BY_TARGET[target];
  const preset = getAllPresets().find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`IconTarget "${target}" mapeia para o preset "${presetId}", que nao existe`);
  }
  return preset;
};

/** Os artefatos SVG que um alvo emite, medidos. */
const svgsDoTarget = (target: IconTarget): string[] =>
  presetDoTarget(target)
    .createArtifacts(contexto())
    .filter((a) => a.format === 'svg')
    .map((a) => a.path);

describe('SVG_EMITTING_TARGETS', () => {
  it('cada alvo da lista emite pelo menos um SVG', () => {
    for (const target of SVG_EMITTING_TARGETS) {
      expect(svgsDoTarget(target).length).toBeGreaterThan(0);
    }
  });

  it('nao sobrou nenhum alvo que emita SVG fora da lista', () => {
    // A direcao que o teste de cima nao pega: e aqui que um alvo novo com `vector()` entra.
    const comSvg = getAllPresets()
      .filter((p) => p.createArtifacts(contexto()).some((a) => a.format === 'svg'))
      .map((p) => p.id)
      .sort();

    const declarados = SVG_EMITTING_TARGETS.map((t) => PRESET_ID_BY_TARGET[t]).sort();

    expect(comSvg).toEqual(declarados);
  });

  it('sao exatamente os dois alvos que a investigacao mediu', () => {
    // Nao e congelado por vaidade: e o alcance do aviso do validador. Um terceiro alvo com
    // SVG muda o contrato — e mudaria o aviso sem ninguem pedir.
    expect([...SVG_EMITTING_TARGETS].sort()).toEqual(['electron', 'web-favicon']);
  });

  it('cada SVG emitido tem extensao .svg', () => {
    for (const target of SVG_EMITTING_TARGETS) {
      for (const path of svgsDoTarget(target)) {
        expect(path).toMatch(/\.svg$/);
      }
    }
  });

  it('os alvos de raster nao emitem SVG, e nao estao na lista', () => {
    // `tauri` e `pwa` sao 100% raster: o texto sai correto neles, e avisar seria ruido.
    for (const target of ['tauri', 'pwa', 'desktop-generic', 'marketing'] as const) {
      expect(SVG_EMITTING_TARGETS).not.toContain(target);
      expect(svgsDoTarget(target)).toHaveLength(0);
    }
  });
});
