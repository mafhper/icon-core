import { defaultMaskRadius, type CanvasMaskShape } from '@iconcore/shared';

/**
 * As **marcas** do slider de frame radius: os valores que as formas de plataforma
 * usam de verdade.
 *
 * ## O que estas marcas são, e por que existem
 *
 * O dono pediu marcacoes no slider para "o retangulo, bordas curvas e circular",
 * clicaveis. O valor da marca **não** é um número inventado para o desenho: é
 * `defaultMaskRadius` da forma — o mesmo que o `PreviewCanvas` usa para pintar o frame
 * e que o `KeylineOverlay` usa para desenhar a guia. Uma marca que apontasse para
 * outro número ensinaria um raio que o app não usa, e a correção do dono seria
 * refazer o ajuste.
 *
 * ## Por que isto é dado, e não um array no componente
 *
 * Porque `defaultMaskRadius` é a **fonte única**, e ela mora em `@iconcore/shared`. Se
 * a lista vivesse no componente, uma plataforma nova exigiria lembrar de atualizar
 * dois lugares — e nenhum teste teria como pegar o esquecimento.
 */

/** As formas que a barra inferior cicla, mais o squircle que o keyline desenha. */
export type RadiusMark = {
  shape: CanvasMaskShape;
  /** O glifo curto que vai **na** marca. */
  label: string;
  /** O que a marca significa, para quem chega pelo leitor de tela. */
  description: string;
};

export const RADIUS_MARKS: readonly RadiusMark[] = [
  { shape: 'square', label: '□', description: 'Square' },
  { shape: 'rounded-rectangle', label: '▢', description: 'Rounded' },
  { shape: 'circle', label: '○', description: 'Circle' },
  { shape: 'squircle', label: '⬭', description: 'Squircle' }
];

/**
 * Onde cada marca cai, em px, para um canvas deste tamanho.
 *
 * `null` quando a marca está **fora** do alcance do slider. Devolver `null` em vez de
 * um número mantém a marca **não clicável**, em vez de clicável para um valor que o
 * frame nunca usa — que seria um botão que mente sobre o que faz.
 */
export const radiusMarkValue = (
  shape: CanvasMaskShape,
  size: number,
  maxRadius: number
): number | null => {
  const value = Math.round(defaultMaskRadius(shape, size));
  return value >= 0 && value <= maxRadius ? value : null;
};

/** A marca que o raio atual representa, se alguma. `null` quando é um valor livre. */
export const markForRadius = (
  radius: number,
  size: number
): RadiusMark | null => {
  const rounded = Math.round(radius);
  return (
    RADIUS_MARKS.find((mark) => Math.round(defaultMaskRadius(mark.shape, size)) === rounded) ?? null
  );
};