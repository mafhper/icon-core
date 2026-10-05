export { composeLayers } from './composeLayers';
export { renderProject, resolveCanvasBackground } from './renderProject';
export { parseHex, rgbToHex, toRgba, clamp01, parseRgba, toOklab, fromOklab, mixOklab } from './color';
export type { Rgb, Oklab } from './color';
export {
  DEFAULT_STOPS,
  normalizeStops,
  sampleStops,
  sampleStopDetailed,
  expandStops,
  expandStopsDetailed,
  cssAngleVector,
  conicStartRadians
} from './gradient';
export { renderToSvg, renderToSvgWithOptions } from './renderToSvg';
export type { RenderSvgOptions, RenderSvgResult } from './renderToSvg';
export { sanitizeSvg } from './sanitizeSvg';
/**
 * `IC63/1b` — recolor de layer `svg`, por cor de origem.
 *
 * Exportado porque o app web precisa **ler o arquivo** para oferecer as cores: sem
 * `extractSvgPaintColors` não há swatch, e sem swatch o override é um valor que a
 * pessoa nunca viu. `pruneSvgPaintOverrides` vem junto porque o mapa que entra no
 * documento tem de estar podado — é o que impede um override inerte de sobreviver à
 * exportação.
 */
export {
  extractSvgPaintColors,
  applySvgPaintOverrides,
  normalizeSvgPaint,
  pruneSvgPaintOverrides
} from './svgPaint';
export type { SvgPaintColor, SvgPaintRole } from './svgPaint';
export { createCanvasBackend } from './backends/canvas';
export { createNodeBackend } from './backends/node';
export { applyMask } from './masks/applyMask';
export { layerBaseRect, containSize } from './geometry';
export type { LayerRect } from './geometry';
export { parseSvgIntrinsicSize, setSvgViewport } from './svgSize';
/**
 * `fonts.ts` — as fontes que o app oferece, e de onde cada uma vem.
 *
 * Exportado do renderer, e nao do app, porque a **fonte e parte da renderizacao**: e o
 * renderer que decide o que o SVG e o canvas conseguem prometer sobre ela, e um seletor no
 * app com a lista propria divergiria do que a exportacao faz na primeira mudanca.
 */
export {
  BUNDLED_FONTS,
  GENERIC_FONTS,
  SELECTABLE_FONTS,
  DEFAULT_FONT_ID,
  DEFAULT_FONT_STACK,
  fontById,
  svgFidelityOf,
  hasBundledFile
} from './fonts';
export type { IconFont, FontOrigin } from './fonts';
export { cssFontFamily, canvasFontShorthand, isItalic, resolveTextPlacement, textBox } from './textLayout';
export type { CanvasFontInput, FontStyle, TextAlign } from './textLayout';
export type {
  RenderBackend,
  RenderBackground,
  RenderContext,
  ImageHandle,
  ResolvedLayer,
  RenderOptions
} from './types';