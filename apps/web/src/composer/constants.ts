// Shared editor constants. Centralized so zoom bounds stay consistent across
// the canvas toolbar, keyboard shortcuts, command palette, and the reducer.
import type { LinearGradientFill } from '@iconcore/shared';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

/** Clamp a zoom value to the supported range. */
export const clampZoom = (zoom: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

/**
 * The signature gold/cyan gradient used for new shape layers and the inspector
 * preset. Returns a fresh object each call so it never becomes shared mutable
 * state in the project tree.
 */
export const brandGradientFill = (): LinearGradientFill => ({
  kind: 'linear-gradient',
  angle: 135,
  stops: [
    { offset: 0, color: '#f3d18a' },
    { offset: 1, color: '#6bb7d8' }
  ]
});

/** Colour a solid fill falls back to when converting from `none`/an empty fill. */
export const DEFAULT_SOLID_COLOR = '#2193b8';

/** Neutral colour used when no fill colour is available at all. */
export const EMPTY_SOLID_COLOR = '#ffffff';
