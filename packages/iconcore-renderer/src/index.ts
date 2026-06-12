export { composeLayers } from './composeLayers';
export { renderProject } from './renderProject';
export { renderToSvg } from './renderToSvg';
export { sanitizeSvg } from './sanitizeSvg';
export { createCanvasBackend } from './backends/canvas';
export { createNodeBackend } from './backends/node';
export { applyMask } from './masks/applyMask';
export type { RenderBackend, RenderContext, ImageHandle, ResolvedLayer } from './types';