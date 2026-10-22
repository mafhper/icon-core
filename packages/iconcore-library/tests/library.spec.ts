import { describe, expect, it } from 'vitest';
import {
  availableTypes,
  buildSvg,
  getIconById,
  getIconVariants,
  searchIcons,
  toLibraryIcon,
  ICONS,
  LIBRARY_VARIANT_IDS,
  type IconEntry,
  type LibraryVariantId
} from '../src/index';

/** Fixture obrigatória: um id que sumiu do derivado é defeito, não motivo de `undefined`. */
const pegar = (id: string): IconEntry => {
  const icon = getIconById(id);
  if (!icon) throw new Error(`fixture ausente no derivado: ${id}`);
  return icon;
};

const variante = (id: string, estilo: LibraryVariantId) => {
  const v = pegar(id).variants[estilo];
  if (!v) throw new Error(`fixture sem variante ${estilo}: ${id}`);
  return v;
};

describe('ICONS — o derivado gerado', () => {
  it('tem os 222 ids da fase A, com as contagens por variante do vendor', () => {
    expect(ICONS.length).toBe(222);
    const contar = (estilo: LibraryVariantId) => ICONS.filter((i) => i.variants[estilo] !== undefined).length;
    expect(contar('normal')).toBe(220);
    expect(contar('duotone')).toBe(218);
    expect(contar('fill')).toBe(129);
  });

  it('está ordenado por id e sem duplicata', () => {
    const ids = ICONS.map((icon) => icon.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não expõe variante fora do subset, nem id do prefixo reservado', () => {
    for (const icon of ICONS) {
      expect(icon.id.startsWith('glass-')).toBe(false);
      expect(icon.name.length).toBeGreaterThan(0);
      expect(icon.category.length).toBeGreaterThan(0);
      const variantes = Object.keys(icon.variants);
      expect(variantes.length).toBeGreaterThan(0);
      for (const estilo of variantes) expect(LIBRARY_VARIANT_IDS).toContain(estilo);
    }
  });

  it('tem viewBox 24×24 e nenhum literal de cor hex no markup', () => {
    for (const icon of ICONS) {
      for (const v of Object.values(icon.variants)) {
        expect(v?.viewBox).toBe('0 0 24 24');
        expect(v?.markup).not.toMatch(/(?:fill|stroke)="#[0-9A-Fa-f]{6}"/);
      }
    }
  });

  it('prefixa ids internos com o id do ícone — seguro para inlining', () => {
    const normal = variante('layouts-layers-2', 'normal');
    expect(normal.markup).toContain('id="layouts-layers-2--clip0_1_3467"');
    expect(normal.markup).toContain('url(#layouts-layers-2--clip0_1_3467)');
    for (const m of normal.markup.matchAll(/id="([^"]+)"/g)) {
      expect(m[1].startsWith('layouts-layers-2--')).toBe(true);
    }
    const outro = variante('tools-sparkles', 'normal');
    expect(outro.markup).toContain('tools-sparkles--clip0_1_2467');
    expect(outro.markup).not.toContain('layouts-layers-2--');
  });
});

describe('getIconById', () => {
  it('devolve o ícone com nome, categoria e tags do manifest do pin', () => {
    const icon = pegar('arrows-arrow-down-left');
    expect(icon.name).toBe('Arrow Down Left');
    expect(icon.category).toBe('navigation');
    expect(icon.tags).toEqual(['navigation', 'arrow', 'down', 'left']);
  });

  it('devolve undefined para id inexistente', () => {
    expect(getIconById('nao-existe')).toBeUndefined();
  });
});

describe('availableTypes', () => {
  it('não inclui fill quando o id não tem fill (cobertura parcial)', () => {
    expect(availableTypes(pegar('arrows-arrow-down-left'))).toEqual(['normal', 'duotone']);
  });

  it('devolve duotone+fill quando o id não tem normal', () => {
    expect(availableTypes(pegar('gadgets-battery-medium-2'))).toEqual(['duotone', 'fill']);
  });

  it('devolve só normal quando é a única variante', () => {
    expect(availableTypes(pegar('gadgets-battery-full'))).toEqual(['normal']);
  });

  it('devolve as três na ordem canônica', () => {
    expect(availableTypes(pegar('layouts-layers-2'))).toEqual(['normal', 'duotone', 'fill']);
  });
});

describe('searchIcons', () => {
  it('com query vazia devolve todos os ícones', () => {
    expect(searchIcons('')).toHaveLength(222);
  });

  it('casa por id, por nome e por tag', () => {
    expect(searchIcons('arrow-down-left').map((i) => i.id)).toContain('arrows-arrow-down-left');
    expect(searchIcons('Git Branch').map((i) => i.id)).toContain('code-git-branch');
    expect(searchIcons('sparkles').map((i) => i.id)).toContain('tools-sparkles');
  });

  it('ignora caixa e espaços nas pontas', () => {
    expect(searchIcons('  ARROW DOWN  ').map((i) => i.id)).toEqual(searchIcons('arrow down').map((i) => i.id));
  });

  it('filtra por variante disponível', () => {
    const comFill = searchIcons('', { type: 'fill' });
    expect(comFill).toHaveLength(129);
    for (const icon of comFill) expect(icon.variants.fill).toBeDefined();
  });

  it('filtra por categoria exata', () => {
    const navegacao = searchIcons('', { category: 'navigation' });
    expect(navegacao).toHaveLength(24);
    for (const icon of navegacao) expect(icon.category).toBe('navigation');
  });

  it('aceita limite como número e como objeto', () => {
    expect(searchIcons('', 5).map((i) => i.id)).toEqual(ICONS.slice(0, 5).map((i) => i.id));
    expect(searchIcons('', { limit: 5 })).toEqual(searchIcons('', 5));
    expect(searchIcons('', { limit: 0 })).toEqual([]);
  });

  it('combina query e filtro', () => {
    const baterias = searchIcons('battery', { category: 'hardware' });
    expect(baterias.length).toBeGreaterThan(0);
    for (const icon of baterias) {
      expect(icon.category).toBe('hardware');
      expect(`${icon.id} ${icon.name} ${icon.tags.join(' ')}`.toLowerCase()).toContain('battery');
    }
  });

  it('devolve lista vazia quando nada casa', () => {
    expect(searchIcons('zzz-nao-existe')).toEqual([]);
  });
});

describe('buildSvg', () => {
  it('monta a raiz com viewBox, fill none e currentColor no miolo', () => {
    const svg = buildSvg('arrows-arrow-down');
    expect(svg).not.toBeNull();
    expect(svg!.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg!.endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/<svg[^>]*\swidth=/);
    expect(svg).not.toMatch(/<svg[^>]*\sheight=/);
  });

  it('aceita tamanho como número e como opção', () => {
    expect(buildSvg('arrows-arrow-down', 'normal', 32)).toContain('width="32" height="32"');
    expect(buildSvg('arrows-arrow-down', 'normal', { size: 20 })).toContain('width="20" height="20"');
  });

  it('aceita className e title, com escape de XML', () => {
    const svg = buildSvg('code-git-branch', 'normal', { className: 'a"b<c&', title: '<x>' });
    expect(svg).toContain('class="a&quot;b&lt;c&amp;"');
    expect(svg).toContain('<title>&lt;x&gt;</title>');
    expect(svg).toContain('role="img"');
    expect(svg).not.toContain('aria-hidden');
  });

  it('devolve null para id inexistente', () => {
    expect(buildSvg('nao-existe')).toBeNull();
  });

  it('rejeita pixelated e glass com null', () => {
    expect(buildSvg('code-git-branch', 'pixelated')).toBeNull();
    expect(buildSvg('code-git-branch', 'glass')).toBeNull();
  });

  it('rejeita variante fora do vocabulário no runtime (brand/color)', () => {
    expect(buildSvg('code-git-branch', 'brand' as unknown as LibraryVariantId)).toBeNull();
    expect(buildSvg('code-git-branch', 'color' as unknown as LibraryVariantId)).toBeNull();
  });

  it('cai para normal quando o fill não existe', () => {
    expect(buildSvg('arrows-arrow-down-left', 'fill')).toBe(buildSvg('arrows-arrow-down-left', 'normal'));
  });

  it('cai para a primeira variante quando o normal não existe', () => {
    const svg = buildSvg('gadgets-battery-medium-2', 'normal');
    expect(svg).not.toBeNull();
    expect(svg).toBe(buildSvg('gadgets-battery-medium-2', 'duotone'));
  });

  it('usa a variante pedida quando ela existe', () => {
    const duotone = buildSvg('arrows-arrow-down-left', 'duotone');
    expect(duotone).toContain('stroke-opacity="0.35"');
    expect(duotone).not.toBe(buildSvg('arrows-arrow-down-left', 'normal'));
  });

  it('aceita a entrada ou o id, com o mesmo resultado', () => {
    const icon = pegar('code-git-branch');
    expect(buildSvg(icon, 'fill')).toBe(buildSvg(icon.id, 'fill'));
  });
});

describe('getIconVariants (adaptador para IconVariantId)', () => {
  it('traduz a disponibilidade sem brand/color', () => {
    expect(getIconVariants('arrows-arrow-down-left')).toEqual(['normal', 'duotone']);
    expect(getIconVariants('gadgets-battery-medium-2')).toEqual(['duotone', 'fill']);
    expect(getIconVariants('code-git-branch')).toEqual(['normal', 'duotone', 'fill']);
    for (const id of ['arrows-arrow-down-left', 'code-git-branch']) {
      expect(getIconVariants(id)).not.toContain('brand');
      expect(getIconVariants(id)).not.toContain('color');
    }
  });

  it('devolve lista vazia para id inexistente', () => {
    expect(getIconVariants('nao-existe')).toEqual([]);
  });
});

describe('toLibraryIcon (adaptador para LibraryIcon)', () => {
  it('monta o contrato compartilhado com data, tags e variants', () => {
    const libraryIcon = toLibraryIcon('arrows-arrow-down-left');
    expect(libraryIcon).not.toBeNull();
    expect(libraryIcon!.id).toBe('arrows-arrow-down-left');
    expect(libraryIcon!.name).toBe('Arrow Down Left');
    expect(libraryIcon!.category).toBe('navigation');
    expect(libraryIcon!.tags).toEqual(['navigation', 'arrow', 'down', 'left']);
    expect(libraryIcon!.variants).toEqual(getIconVariants('arrows-arrow-down-left'));
    expect(libraryIcon!.data).toBe(buildSvg('arrows-arrow-down-left', 'normal'));
    expect(libraryIcon!.data).toContain('currentColor');
  });

  it('aceita a variante pedida, com o fallback do buildSvg', () => {
    expect(toLibraryIcon('arrows-arrow-down-left', 'fill')!.data).toBe(
      buildSvg('arrows-arrow-down-left', 'normal')
    );
  });

  it('adapta os 222 ícones sem null', () => {
    for (const icon of ICONS) expect(toLibraryIcon(icon)).not.toBeNull();
  });

  it('devolve null para id inexistente', () => {
    expect(toLibraryIcon('nao-existe')).toBeNull();
  });

  it('leva o id prefixado dos ids internos para o data (inlining-safe)', () => {
    expect(toLibraryIcon('layouts-layers-2')!.data).toContain('layouts-layers-2--clip0_1_3467');
  });
});
