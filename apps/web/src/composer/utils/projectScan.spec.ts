import { describe, expect, it } from 'vitest';
import {
  findImageReferences,
  isDocumentPath,
  isImagePath,
  resolveRelative,
  scanProject,
  type ScannedFile
} from './projectScan';

/**
 * Testes da análise de pasta.
 *
 * O critério aqui não é "a análise acerta" — é **"a análise sabe quando não sabe"**. Uma
 * proposta que erra e diz que errou é utilizável; uma que erra com confiança alta quebra a
 * pasta de quem opened, e o teste abaixo existe para que essa seja uma falha barulhenta.
 */

const doc = (size: number, height?: number): string =>
  JSON.stringify({ schemaVersion: 3, metadata: { name: 'x', shortName: 'x' }, canvas: { size, ...(height ? { height } : {}) } });

const file = (path: string, text?: string, size = 1024): ScannedFile => ({
  path,
  size,
  ...(text === undefined ? {} : { text })
});

describe('classificação de caminho', () => {
  it('reconhece documento só no sufixo exato', () => {
    expect(isDocumentPath('a.icone.iconcore.json')).toBe(true);
    expect(isDocumentPath('A.ICONS.ICONCORE.JSON')).toBe(true);
    expect(isDocumentPath('icon.json')).toBe(false);
    expect(isDocumentPath('iconcore.json')).toBe(false);
  });

  it('reconhece imagem por extensão, sem diferenciar caixa', () => {
    expect(isImagePath('a/b/Logo.PNG')).toBe(true);
    expect(isImagePath('x.webp')).toBe(true);
    expect(isImagePath('x.txt')).toBe(false);
    expect(isImagePath('sem-extensao')).toBe(false);
  });

  it('resolve caminho relativo, e .. não escapa da raiz', () => {
    expect(resolveRelative('src/pages', '../assets/logo.png')).toBe('src/assets/logo.png');
    expect(resolveRelative('src', './logo.png')).toBe('src/logo.png');
    expect(resolveRelative('', 'logo.png')).toBe('logo.png');
    expect(resolveRelative('a/b', '../../../logo.png')).toBe('logo.png');
  });
});

describe('findImageReferences', () => {
  it('acha string entre aspas com extensão conhecida', () => {
    const refs = findImageReferences(
      ['import x from "./logo.png";', "const b = '/assets/bg.webp';", 'const c = `~/icon.svg`;'].join('\n')
    );
    expect(refs).toEqual(['./logo.png', '/assets/bg.webp', '~/icon.svg']);
  });

  it('descarta data URI, glob e query, mas guarda o caminho', () => {
    const refs = findImageReferences(
      ['const a = "data:image/png;base64,AAAA";', 'const b = "icons/*.png";', 'const c = "hero.png?v=2";'].join('\n')
    );
    expect(refs).toEqual(['hero.png']);
  });

  it('não casa extensão que é só prefixo de outra', () => {
    expect(findImageReferences('"nota.png.txt"')).toEqual([]);
  });

  // Estas três são a regressão que a 1ª versão do teste não pegava: a única forma de
  // cobertura de `findImageReferences` era por aspas, e a forma mais comum de citar
  // imagem num README — `![](./x.png)` — **não tem aspas**.
  it('acha markdown inline, que não tem aspas', () => {
    expect(findImageReferences('![](./hero.png)')).toEqual(['./hero.png']);
  });

  it('acha markdown por definição', () => {
    expect(findImageReferences('![x][r]\n\n[r]: ./logo.svg')).toEqual(['./logo.svg']);
  });

  it('descarta o título opcional do markdown', () => {
    expect(findImageReferences('![](./a.png "O logo")')).toEqual(['./a.png']);
  });

  it('junta as três sintaxes sem repetir', () => {
    const text = ['import a from "./logo.png";', '![](./hero.png)', '[r]: ./bg.webp', '![](./hero.png)'].join('\n');
    expect(findImageReferences(text)).toEqual(['./logo.png', './hero.png', './bg.webp']);
  });
});

describe('scanProject — documentos', () => {
  it('quadrado pequeno é logo com confiança alta', () => {
    const r = scanProject({ files: [file('icone.iconcore.json', doc(512))] });
    expect(r.candidates[0]).toMatchObject({ role: 'logo', confidence: 'high' });
  });

  it('quadrado grande não é ícone: confiança desce', () => {
    const r = scanProject({ files: [file('grande.iconcore.json', doc(2048))] });
    expect(r.candidates[0]).toMatchObject({ role: 'logo', confidence: 'medium' });
  });

  it('não-quadrado é asset', () => {
    const r = scanProject({ files: [file('banner.iconcore.json', doc(1200, 630))] });
    expect(r.candidates[0]).toMatchObject({ role: 'asset', confidence: 'high' });
  });

  it('documento sem texto fica em unresolved, não vira candidato', () => {
    const r = scanProject({ files: [file('icone.iconcore.json')] });
    expect(r.candidates).toHaveLength(0);
    expect(r.unresolved).toContain('icone.iconcore.json');
  });

  it('documento corrompido avisa em vez de virar candidato', () => {
    const r = scanProject({ files: [file('quebrado.iconcore.json', '{ isso nao e json')] });
    expect(r.candidates).toHaveLength(0);
    expect(r.warnings.some((w) => w.includes('quebrado.iconcore.json'))).toBe(true);
  });

  it('recupera o canvas de documento com lixo em volta, e diz que sabe o suficiente', () => {
    const r = scanProject({ files: [file('x.iconcore.json', `lixo antes {"canvas":{"size":512,"height":300}} lixo depois`)] });
    expect(r.candidates[0]).toMatchObject({ role: 'asset', confidence: 'high' });
  });
});

describe('scanProject — o manifesto manda', () => {
  it('logo declarado vira candidato high e o remove da lista de propostas', () => {
    const r = scanProject({
      files: [file('icone.iconcore.json', doc(512)), file('outro.iconcore.json', doc(512))],
      manifest: { schemaVersion: 1, logo: 'outro.iconcore.json' }
    });
    const logos = r.candidates.filter((c) => c.role === 'logo');
    expect(logos).toHaveLength(1);
    expect(logos[0]).toMatchObject({ path: 'outro.iconcore.json', confidence: 'high' });
  });

  it('logo declarado que não existe avisa, e não inventa substituto', () => {
    const r = scanProject({
      files: [file('icone.iconcore.json', doc(512))],
      manifest: { schemaVersion: 1, logo: 'sumiu.iconcore.json' }
    });
    expect(r.warnings.some((w) => w.includes('sumiu.iconcore.json'))).toBe(true);
    expect(r.candidates.some((c) => c.role === 'logo')).toBe(true);
  });
});

describe('scanProject — o que fica de fora', () => {
  it('ignora node_modules em qualquer nível', () => {
    const r = scanProject({
      files: [file('node_modules/p/icon.png'), file('apps/web/node_modules/q/icon.png'), file('logo.png')]
    });
    expect(r.unresolved).not.toContain('node_modules/p/icon.png');
    expect(r.unresolved).not.toContain('apps/web/node_modules/q/icon.png');
  });

  it('honra manifest.ignore', () => {
    const r = scanProject({
      files: [file('vendor/logo.png')],
      manifest: { schemaVersion: 1, ignore: ['vendor'] }
    });
    expect(r.unresolved).not.toContain('vendor/logo.png');
  });

  it('não proposta favicon nem ícone de sistema, que são ruído conhecido', () => {
    const r = scanProject({
      files: [file('favicon.ico'), file('apple-touch-icon.png'), file('android-chrome-192x192.png')]
    });
    expect(r.candidates).toHaveLength(0);
  });
});

describe('scanProject — referências em código', () => {
  it('cita imagem existente como asset de confiança baixa', () => {
    const r = scanProject({
      files: [
        file('src/app.ts', 'import a from "./assets/hero.png"'),
        file('src/assets/hero.png')
      ]
    });
    const c = r.candidates.find((x) => x.path === 'src/assets/hero.png');
    expect(c).toMatchObject({ role: 'asset', confidence: 'low' });
  });

  it('nome de logo sobe a confiança, mesmo sem ser documento', () => {
    const r = scanProject({
      files: [file('src/app.ts', 'import a from "./brand-logo.png"'), file('src/brand-logo.png')]
    });
    const c = r.candidates.find((x) => x.path === 'src/brand-logo.png');
    expect(c).toMatchObject({ role: 'logo', confidence: 'medium' });
  });

  it('referência quebrada em markdown avisa; em código, cala', () => {
    const r = scanProject({
      files: [file('README.md', '![](./sumiu.png)'), file('src/app.ts', 'import a from "./sumiu2.png"')]
    });
    expect(r.warnings.some((w) => w.includes('sumiu.png'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('sumiu2.png'))).toBe(false);
  });

  it('não cita documento como asset: documento já foi classificado', () => {
    const r = scanProject({
      files: [file('src/app.ts', 'import d from "../icone.iconcore.json"'), file('icone.iconcore.json', doc(512))]
    });
    const assetCandidates = r.candidates.filter((c) => c.role === 'asset');
    expect(assetCandidates.some((c) => c.path.endsWith('.iconcore.json'))).toBe(false);
  });

  it('o logo do documento não é re-proposto como logo de imagem', () => {
    const r = scanProject({
      files: [file('src/app.ts', 'import a from "./icone.iconcore.json"'), file('icone.iconcore.json', doc(512))]
    });
    expect(r.candidates.filter((c) => c.role === 'logo').map((c) => c.path)).toEqual(['icone.iconcore.json']);
  });
});

describe('scanProject — o caso do dono', () => {
  it('projeta a pasta que ele descreveu: um ícone, um banner, um logo citado', () => {
    const r = scanProject({
      files: [
        file('icone.iconcore.json', doc(512)),
        file('banner.iconcore.json', doc(1200, 630)),
        file('src/hero.tsx', 'import logo from "./assets/logo.svg"'),
        file('src/assets/logo.svg'),
        file('package.json', '{"name":"x"}')
      ]
    });
    expect(r.candidates.map((c) => [c.role, c.path])).toEqual([
      ['logo', 'icone.iconcore.json'],
      ['asset', 'banner.iconcore.json'],
      ['logo', 'src/assets/logo.svg']
    ]);
  });
});