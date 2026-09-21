export { composeLayers } from './composeLayers';
export { renderProject, resolveCanvasBackground } from './renderProject';
export { parseHex, rgbToHex, toRgba, clamp01, toOklab, fromOklab, mixOklab } from './color';
export type { Rgb, Oklab } from './color';
export {
  DEFAULT_STOPS,
  normalizeStops,
  sampleStops,
  expandStops,
  expandStopsDetailed,
  cssAngleVector,
  conicStartRadians
} from './gradient';
export { renderToSvg } from './renderToSvg';
export { sanitizeSvg } from './sanitizeSvg';
export { createCanvasBackend } from './backends/canvas';
export { createNodeBackend } from './backends/node';
export { applyMask } from './masks/applyMask';
export { layerBaseRect, containSize } from './geometry';
export type { LayerRect } from './geometry';
export type { RenderBackend, RenderContext, ImageHandle, ResolvedLayer, RenderOptions } from './types';