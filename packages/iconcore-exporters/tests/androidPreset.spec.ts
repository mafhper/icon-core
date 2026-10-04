import { describe, expect, it } from 'vitest';
import type { IconCoreProject, IconVariant } from '@iconcore/shared';
import { getAllPresets } from '../src/presets';
import { buildPlan } from '../src/planner';
import { generateAndroidAdaptiveIcon } from '../src/pipeline/attachments';
import type { PlannedArtifact } from '../src/pipeline/types';

/**
 * O preset Android, verificado nas três coisas que podem estar erradas sem erro nenhum:
 *
 * 1. **a safe zone é aplicada** — um foreground full-bleed é cortado por **toda** máscara
 *    do launcher, e o sintoma é um ícone com a borda comida que a pessoa não sabe
 *  ributedir;
 * 2. **as camadas e os tamanhos estão certos** — 108dp por densidade para as camadas,
 *    48dp para o legado, e `anydpi-v26` é onde o XML tem que estar;
 * 3. **não emite SVG** — o Android não lê SVG para ícone de app. Um `favicon.svg` aqui
 *    seria um arquivo que ninguém abre.
 *
 * Os números vêm da documentação da plataforma, não de escolha: as camadas são
 * 108×108dp e só os **66×66dp centrais** sobrevivem à máscara.
 */
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

const android = () => {
  const preset = getAllPresets().find((p) => p.id === 'android');
  if (!preset) throw new Error('preset android ausente');
  return preset;
};

const variante: IconVariant = 'default';
const contexto = () => ({ project: projeto(), variants: [variante] });

const artefatos = () => android().createArtifacts(contexto());

describe('preset android — o que ele emite', () => {
  it('nao emite SVG: o Android nao le SVG para icone de app', () => {
    // A regra do dono: "se o Android nao le o SVG, nao faz sentido exportar o formato
    // para esse preset". O Android le VectorDrawable, que e XML com `<path>` — outro
    // formato, com outro nome. Nao ha `.svg` num projeto Android.
    const formatos = new Set(artefatos().map((a) => a.format));
    expect(formatos).toEqual(new Set(['png']));
    expect(artefatos().some((a) => a.path.endsWith('.svg'))).toBe(false);
  });

  it('declara a plataforma android, e so ela', () => {
    expect(android().platforms).toEqual(['android']);
  });

  it('tem as duas camadas adaptive nas cinco densidades', () => {
    const densidades = [
      ['mdpi', 108],
      ['hdpi', 162],
      ['xhdpi', 216],
      ['xxhdpi', 324],
      ['xxxhdpi', 432]
    ] as const;

    for (const [densidade, px] of densidades) {
      const foreground = artefatos().find(
        (a) => a.path === `mipmap-${densidade}/ic_launcher_foreground.png`
      );
      const background = artefatos().find(
        (a) => a.path === `mipmap-${densidade}/ic_launcher_background.png`
      );
      // 108dp na densidade: mdpi(160) 108 · hdpi(240) 162 · xhdpi(320) 216 …
      expect(foreground?.size, `foreground ${densidade}`).toBe(px);
      expect(background?.size, `background ${densidade}`).toBe(px);
    }
  });

  it('a foreground tem safe zone de 66/108, e a background nao', () => {
    // Este e' o ponto inteiro do preset. Sem `safeZone` no foreground, o logo preenche
    // os 108dp e a mascara do launcher corta 18dp de cada lado.
    const foreground = artefatos().find((a) => a.path.endsWith('xhdpi/ic_launcher_foreground.png'));
    expect(foreground?.safeZone).toBeCloseTo(66 / 108, 10);

    // A background e full bleed de proposito: e ela que preenche a mascara.
    const background = artefatos().find((a) => a.path.endsWith('xhdpi/ic_launcher_background.png'));
    expect(background?.safeZone).toBeUndefined();
  });

  it('a background e opaca, porque a mascara nao aceita transparencia', () => {
    const background = artefatos().find((a) => a.path.endsWith('xhdpi/ic_launcher_background.png'));
    expect(background?.background).toBe('opaque');
  });

  it('inclui o launcher legado nas cinco densidades, para abaixo da API 26', () => {
    const legado = [
      ['mdpi', 48],
      ['hdpi', 72],
      ['xhdpi', 96],
      ['xxhdpi', 144],
      ['xxxhdpi', 192]
    ] as const;
    for (const [densidade, px] of legado) {
      for (const nome of ['ic_launcher.png', 'ic_launcher_round.png']) {
        const artefato = artefatos().find((a) => a.path === `mipmap-${densidade}/${nome}`);
        expect(artefato?.size, `${densidade}/${nome}`).toBe(px);
      }
    }
  });

  it('inclui o icone do Play Store, 512 e opaco', () => {
    // O Play rejeita alfa e aplica o proprio arredondamento.
    const play = artefatos().find((a) => a.path === 'play-store-512.png');
    expect(play?.size).toBe(512);
    expect(play?.background).toBe('opaque');
  });

  it('nenhum caminho colide entre artefatos', () => {
    // Dois artefatos no mesmo path significa que um sobrescreve o outro, e o export
    // avisa — mas so depois de ter gerado o arquivo errado.
    const caminhos = artefatos().map((a) => a.path);
    expect(new Set(caminhos).size).toBe(caminhos.length);
  });
});

describe('preset android — o XML que declara o adaptive', () => {
  const planejado = (): PlannedArtifact[] =>
  buildPlan(contexto(), 'android').artifacts.map(
    (a) =>
      ({
        artifact: a,
        path: a.path,
        format: a.format,
        mime: '',
        size: a.size ?? 0
      }) as PlannedArtifact
  );

  it('declara as duas camadas', () => {
    const xml = generateAndroidAdaptiveIcon(planejado()).content;
    expect(xml).toContain('<adaptive-icon');
    expect(xml).toContain('<background android:drawable="@mipmap/ic_launcher_background"/>');
    expect(xml).toContain('<foreground android:drawable="@mipmap/ic_launcher_foreground"/>');
  });

  it('nao declara <monochrome> quando a camada nao existe', () => {
    // Um `@drawable/ic_launcher_monochrome` que nao existe no projeto faz o `aapt`
    // falhar com resource-not-found. Melhor o XML sem a linha do que um XML que nao
    // compila — e o preset ainda nao produz a camada.
    const xml = generateAndroidAdaptiveIcon(planejado()).content;
    expect(xml).not.toContain('monochrome');
  });

  it('declara <monochrome> quando a camada existe', () => {
    const comCamada = [
      ...planejado(),
      {
        artifact: { id: 'ic_launcher_monochrome', format: 'png', path: 'mipmap-xhdpi/ic_launcher_monochrome.png', enabled: true, size: 216 },
        path: 'mipmap-xhdpi/ic_launcher_monochrome.png',
        format: 'png',
        mime: '',
        size: 216
      } as unknown as PlannedArtifact
    ];
    const xml = generateAndroidAdaptiveIcon(comCamada).content;
    expect(xml).toContain('<monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>');
  });

  it('o plano declara os dois XML em mipmap-anydpi-v26', () => {
    // Fora dessa pasta o Android ignora o arquivo e cai no PNG legado: o export gera as
    // camadas, e ninguem descobre por que a mascara do launcher nao se aplica.
    const plan = buildPlan(contexto(), 'android');
    const caminhos = plan.attachments.map((a) => a.path);
    expect(caminhos).toContain('mipmap-anydpi-v26/ic_launcher.xml');
    expect(caminhos).toContain('mipmap-anydpi-v26/ic_launcher_round.xml');
  });
});