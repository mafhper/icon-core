/**
 * @iconcore/library — a biblioteca Rune embarcada (normal/duotone/fill).
 *
 * ## O que é
 *
 * Os ícones vendorizados em `assets/icons-rune/` (pin `2f2a86a`; ver `SOURCE.md`), servidos
 * por uma API fina de dados — busca, leitura e montagem de SVG. Nada aqui edita, insere ou
 * importa: a biblioteca é domínio/dados puro, e operações editoriais são do Composer. Zero
 * rede em runtime — o acervo inteiro mora em `icons.generated.ts`, derivado do disco por
 * `scripts/build-rune-library.mjs` e cobrado pelo `--check` no CI.
 *
 * ## Variantes
 *
 * Só `normal`/`duotone`/`fill` são redistribuídas nesta fase (pixelated/glass/sprites são o
 * delta B, enfileirado). `pixelated` e `glass` são **rejeitados com `null`**: um pedido
 * explícito de variante que o acervo não tem não vira um fallback silencioso. `brand` e
 * `color` — variantes de projeto, não estilos de biblioteca — ficam fora do tipo. Quando a
 * variante pedida existe, ela é usada; quando não existe (o `fill` cobre 129 de 222 ids por
 * desenho do upstream), o `buildSvg` cai para `normal` — a mesma regra do vendor ("o fallback
 * para `normal` é do consumidor").
 *
 * ## Adaptadores
 *
 * `toLibraryIcon` e `getIconVariants` traduzem para o contrato de `@iconcore/shared`
 * (`LibraryIcon`/`IconVariantId`) — a única dependência do pacote, e só de tipos.
 */
import type { IconVariantId, LibraryIcon } from '@iconcore/shared';
import { ICONS, type IconEntry, type LibraryVariantId } from './icons.generated';

export { ICONS };
export type { IconEntry, IconVariant, LibraryVariantId } from './icons.generated';

/** A ordem canônica das variantes redistribuídas. */
export const LIBRARY_VARIANT_IDS: readonly LibraryVariantId[] = ['normal', 'duotone', 'fill'];

const BY_ID = new Map(ICONS.map((icon) => [icon.id, icon]));

/** O ícone de um id, ou `undefined` quando não existe. */
export function getIconById(id: string): IconEntry | undefined {
  return BY_ID.get(id);
}

/** As variantes que o ícone realmente tem, na ordem canônica — sem fallback. */
export function availableTypes(icon: IconEntry): LibraryVariantId[] {
  return LIBRARY_VARIANT_IDS.filter((variante) => icon.variants[variante] !== undefined);
}

export interface SearchOptions {
  /** Só ícones com variante neste estilo. */
  type?: LibraryVariantId;
  /** Categoria exata (ex.: `navigation`). */
  category?: string;
  /** Máximo de resultados. */
  limit?: number;
}

/**
 * Busca por texto — id, nome e tags, case-insensitive, com `trim`; vazio casa tudo — com
 * filtros de estilo/categoria. `options` pode ser um número, que vale como `limit`.
 * O resultado preserva a ordem de `ICONS` (por id).
 */
export function searchIcons(query: string, options?: SearchOptions | number): IconEntry[] {
  const { type, category, limit } = typeof options === 'number' ? { limit: options } : (options ?? {});
  const texto = query.trim().toLowerCase();
  const resultados = ICONS.filter((icon) => {
    if (type !== undefined && icon.variants[type] === undefined) return false;
    if (category !== undefined && icon.category !== category) return false;
    if (texto === '') return true;
    if (icon.id.toLowerCase().includes(texto)) return true;
    if (icon.name.toLowerCase().includes(texto)) return true;
    return icon.tags.some((tag) => tag.toLowerCase().includes(texto));
  });
  return limit === undefined ? resultados : resultados.slice(0, Math.max(0, limit));
}

export interface BuildSvgOptions {
  /** `width`/`height` do `<svg>`; o `viewBox` é preservado, então o ícone escala para a caixa. */
  size?: number;
  /** Classe no `<svg>` (escapada). */
  className?: string;
  /** Título acessível: com ele o `<svg>` vira `role="img"` com `<title>`; sem ele, `aria-hidden`. */
  title?: string;
}

/** Estilos que existem no acervo upstream mas **não** são redistribuídos — rejeitados com `null`. */
export type UnshippedVariantId = 'pixelated' | 'glass';

/** Um mapa de entidades numa passada única — `&` primeiro por construção, nunca em cadeia. */
const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

const escapeXml = (valor: string): string => valor.replace(/[&<>"']/g, (ch) => ENTIDADES[ch]);

/**
 * Monta o SVG de um ícone numa variante — a raiz é composta aqui (viewBox + `fill="none"` +
 * tamanho/classe/título), e o miolo vem do derivado, com ids internos já prefixados.
 *
 * Devolve `null` quando o id não existe ou quando a variante não é redistribuída
 * (`pixelated`/`glass`, e qualquer valor fora das três no runtime). Variante ausente cai
 * para `normal`; sem `normal` (2 ids do upstream), cai para a primeira disponível.
 */
export function buildSvg(
  icon: IconEntry | string,
  type: LibraryVariantId | UnshippedVariantId = 'normal',
  options: BuildSvgOptions | number = {}
): string | null {
  const entrada = typeof icon === 'string' ? getIconById(icon) : icon;
  if (!entrada) return null;
  if (!LIBRARY_VARIANT_IDS.includes(type as LibraryVariantId)) return null;

  const pedida = type as LibraryVariantId;
  const variante =
    entrada.variants[pedida] ??
    entrada.variants.normal ??
    LIBRARY_VARIANT_IDS.map((t) => entrada.variants[t]).find((v) => v !== undefined);
  if (!variante) return null;

  const { size, className, title } = typeof options === 'number' ? { size: options } : options;
  const atributos = ['xmlns="http://www.w3.org/2000/svg"', `viewBox="${variante.viewBox}"`, 'fill="none"'];
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    atributos.push(`width="${size}"`, `height="${size}"`);
  }
  if (className) atributos.push(`class="${escapeXml(className)}"`);
  atributos.push(title ? 'role="img"' : 'aria-hidden="true"');
  const titulo = title ? `<title>${escapeXml(title)}</title>` : '';
  return `<svg ${atributos.join(' ')}>${titulo}${variante.markup}</svg>`;
}

/** As variantes de um id no vocabulário de `@iconcore/shared` — `brand`/`color` nunca aparecem. */
export function getIconVariants(id: string): IconVariantId[] {
  const entrada = getIconById(id);
  return entrada ? availableTypes(entrada) : [];
}

/**
 * Adapta um ícone (ou id) para o `LibraryIcon` do contrato compartilhado. `data` é o SVG da
 * variante pedida (default `normal`, com o fallback do `buildSvg`); `variants` é a
 * disponibilidade real. Devolve `null` quando o id não existe.
 */
export function toLibraryIcon(icon: IconEntry | string, variant?: LibraryVariantId): LibraryIcon | null {
  const entrada = typeof icon === 'string' ? getIconById(icon) : icon;
  if (!entrada) return null;
  const data = buildSvg(entrada, variant ?? 'normal');
  if (data === null) return null;
  return {
    id: entrada.id,
    name: entrada.name,
    category: entrada.category,
    tags: [...entrada.tags],
    data,
    variants: getIconVariants(entrada.id)
  };
}
