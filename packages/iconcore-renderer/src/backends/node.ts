import type { RenderBackend } from '../types';

export const createNodeBackend = (): RenderBackend => {
  throw new Error(
    'Node backend is not yet implemented. Use the Canvas backend for browser rendering or wait for Phase 6 (CLI) when sharp integration is added.'
  );
};