import type { IconLayer } from '@iconcore/shared';
import { extractSvgPaintColors, pruneSvgPaintOverrides, type SvgPaintColor } from '@iconcore/renderer';

/**
 * As cores de paint que uma layer `svg` carrega, lidas do markup.
 *
 * O markup vem em base64 dentro de `source.data`, e é o **único** lugar onde a cor
 * existe: uma layer `svg` não tem `fill` próprio, e o `Fill` do inspector mostrava
 * "transparent" para uma camada que estava desenhando branco na tela. Ler o arquivo é
 * a única forma de oferecer o que a pessoa pediu — trocar a cor, e não trocá-la às
 * cegas.
 *
 * Devolve lista vazia em qualquer coisa que não seja um SVG legível: um layer sem
 * markup, base64 inválido, ou `kind` diferente. Um erro aqui viraria um painel com
 * "erro" no lugar dos swatches, e a pessoa não teria como sair.
 */
export const readSvgLayerColors = (layer: Pick<IconLayer, 'kind' | 'source'>): SvgPaintColor[] => {
  if (layer.kind !== 'svg') return [];
  const data = layer.source.data;
  if (!data) return [];

  let markup: string;
  try {
    markup = atob(data);
  } catch {
    return [];
  }

  try {
    return extractSvgPaintColors(markup);
  } catch {
    return [];
  }
};

/**
 * O valor efetivo de uma cor: o override quando existe, o valor do arquivo quando não.
 *
 * Devolve a string que o browser entende, e não um hex — porque a chave pode ser um
 * token opaco (`currentcolor`, `canvastext`), e o swatch precisa mostrar exatamente o
 * que o renderizador vai usar.
 */
export const effectiveSvgPaint = (
  source: string,
  overrides: Record<string, string> | undefined
): string => overrides?.[source] ?? source;

/** Há override efetivo para esta cor? Só quando o valor **muda** de verdade. */
export const hasSvgPaintOverride = (
  source: string,
  overrides: Record<string, string> | undefined
): boolean => {
  const atual = overrides?.[source];
  return atual !== undefined && atual !== source;
};

/**
 * Um clique no swatch. Devolve o mapa novo, já podado.
 *
 * Podar na fronteira importa por dois motivos: o histórico fica com entradas que fazem
 * alguma coisa, e um mapa cheio de substituições inertes sobrevive à exportação — e é
 * assim que um override que "não faz nada" vira lenda dentro de um projeto.
 */
export const withSvgPaintOverride = (
  overrides: Record<string, string> | undefined,
  source: string,
  target: string
): Record<string, string> => pruneSvgPaintOverrides({ ...overrides, [source]: target });

/** O mapa sem nenhuma substituição. O botão "voltar ao original" de cada linha. */
export const withoutSvgPaintOverride = (
  overrides: Record<string, string> | undefined,
  source: string
): Record<string, string> => {
  const proximo = { ...(overrides ?? {}) };
  delete proximo[source];
  return proximo;
};

/**
 * Quantas cores do arquivo **não** estão no mapa — seja por nunca terem sido
 * tocadas, seja por a chave não existir mais no arquivo.
 *
 * O segundo caso é o que dói: um override que sobrevive a uma edição do SVG e passa a
 * não casar com nada. Chave órfã é um controle que mente, e é a mesma classe do
 * `IC-N26` (fonte que some calada).
 */
export const countOrphanOverrides = (
  overrides: Record<string, string> | undefined,
  colors: SvgPaintColor[]
): number => {
  const presentes = new Set(colors.map((c) => c.hex));
  return Object.keys(overrides ?? {}).filter((chave) => !presentes.has(chave)).length;
};