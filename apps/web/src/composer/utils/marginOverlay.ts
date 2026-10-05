/**
 * A máscara da `import margin`: onde a arte **vai** ocupar o canvas.
 *
 * ## O que isto é, e por que é necessário
 *
 * O dono pediu um reforço visual ao mexer na margem, e ele está certo por um motivo
 * concreto: o `importMargin` é aplicado **na próxima importação**, e o `LayerInspector`
 * diz isso na dica. Mas um controle que só afeta o futuro, com nenhuma indicação de
 * onde o futuro vai ficar, é um controle que se ajusta às cegas.
 *
 * ## A regra que a máscara espelha
 *
 * Não é uma segunda fórmula: `fitAssetSize` (`projectFactory.ts`) calcula
 * `usable = canvasSize × (1 - margin)` e centra a arte. A máscara usa **exatamente** a
 * mesma expressão, lida daqui. Duas formulas para a mesma medida divergem no primeiro
 * ajuste de margem, e o dono veria a guia discordar da arte — que é a Sintoma 2 do
 * `IC-N4` de novo, agora em forma de geometria.
 *
 * ## Por que retângulo tracejado, e não uma imagem
 *
 * Porque a máscara é **prévia da área**, não da arte. Um retrato borrado ou uma miniatura
 * seria uma informação falsa: a arte entra depois, e o que existe agora é só a caixa.
 * Tracejado com linha de 1px diz "limite", e `--ic-accent` com alpha baixo diz "guia" em
 * vez de "conteúdo".
 */

/** A geometria da área útil, em unidades do canvas. */
export interface MarginGeometry {
  /** Largura da área, em px do documento. */
  width: number;
  /** Altura da área. */
  height: number;
  /** `x` do canto superior esquerdo. */
  x: number;
  /** `y` do canto superior esquerdo. */
  y: number;
}

/**
 * A área que a arte ocupa, para um canvas e uma margem.
 *
 * `margin` é a fração que fica **vazia** (0.2 = 20% de respiro, como o `LayerInspector`
 * promete). O clamp espelha `fitAssetSize`: uma margem negativa daria `usable > canvas`, e
 * a guia sairia do canvas — que é pior que não desenhar nada.
 */
export const marginGeometry = (canvasSize: number, margin: number): MarginGeometry => {
  const size = Math.max(1, canvasSize);
  const clamped = Math.max(0, Math.min(0.45, Number.isFinite(margin) ? margin : 0));
  const usable = size * (1 - clamped);
  const offset = (size - usable) / 2;
  return {
    width: usable,
    height: usable,
    x: offset,
    y: offset
  };
};

/**
 * O tracejado, como **dash array** de um `stroke-dasharray`.
 *
 * Calculado do tamanho da área, e nao um número fixo: um tracejado de 8px numa guia de
 * 24px dá 3 tracejados, e na mesma guia num canvas de 1024 dá 128. Um padrão fixo deixa
 * de parecer tracejado conforme o canvas cresce.
 */
/**
 * O tracejado, como **dash array** de um `stroke-dasharray`.
 *
 * Calculado da **área e da espessura do traço**, e não de um número fixo: um tracejado
 * de 8px numa guia de 24px dá 3 tracejados, e na mesma guia num canvas de 1024 dá 128.
 * Um padrão fixo deixa de parecer tracejado conforme o canvas cresce.
 *
 * A espessura entra porque o tracejado tem de ter o **mesmo peso visual** da linha que
 * o desenha: um `on` muito curto em um traço de 2px é lido como pontilhado fino, e em um
 * traço de 6px vira quase sólido. `on ≈ 8 × stroke` mantém a proporção — e o piso de 2
 * protege o caso de `stroke` fraco num canvas pequeno.
 */
export const marginDash = (areaSize: number, stroke: number): string => {
  const on = Math.max(2, Math.round(areaSize / 32), Math.round(stroke * 8));
  const off = Math.max(2, Math.round(on * 0.7));
  return `${on} ${off}`;
};

/**
 * Uma margem e **visível** quando a guia cabe dentro do canvas.
 *
 * Abaixo de ~8px de lado a guia deixa de se ler como retângulo e vira um borrão de
 * linha; e a 45% (o clamp) ainda cabe. Um piso explícito é melhor do que deixar o
 * browser decidir a legibilidade.
 */
export const isMarginGuideVisible = (areaSize: number): boolean => areaSize >= 8;