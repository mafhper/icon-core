import type { CSSProperties } from 'react';

/**
 * Decorative backgrounds that live in inline styles instead of `index.css`.
 *
 * Not a line-budget workaround: the promo stylesheet still has headroom under
 * `.ui-budget.json`. Each treatment has exactly one consumer and depends on custom
 * properties that consumer writes on that element — the hero stage sets `--px`/`--py` for
 * the specular highlight, the footer sets `--fx`/`--fy` for the wordmark and its glow — so
 * these are one-off decorations rather than roles worth naming in the stylesheet. Colors
 * come from tokens, so both themes follow.
 */

/** Glass highlight that follows the pointer (the stage writes `--px` / `--py`). */
export const SPECULAR_STYLE: CSSProperties = {
  background: [
    'radial-gradient(60% 55% at calc(38% - var(--px, 0) * 22%) calc(26% - var(--py, 0) * 22%), var(--spec) 0%, transparent 60%)',
    'linear-gradient(180deg, color-mix(in oklab, var(--spec) 45%, transparent) 0%, transparent 38%)',
  ].join(', '),
  boxShadow: 'inset 0 1.5px 0 var(--rim), inset 0 0 0 1px color-mix(in oklab, var(--rim) 40%, transparent)',
  mixBlendMode: 'soft-light',
};

/** 32 px grid, faded out toward the bottom of its box. */
export const GRID_STYLE: CSSProperties = {
  backgroundImage: [
    'linear-gradient(to right, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)',
    'linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: '32px 32px',
  maskImage: 'linear-gradient(to bottom, black, transparent 70%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 70%)',
};

/**
 * Footer wordmark: a faint plate lit by a radial gradient under the pointer. The `--fx`
 * fallback keeps it visible before the first pointer move, which is also what runs when
 * JavaScript never touches the footer.
 */
export const WORDMARK_STYLE: CSSProperties = {
  color: 'transparent',
  backgroundImage: [
    'radial-gradient(26rem 14rem at var(--fx, 50%) 40%, var(--cyan), color-mix(in oklab, var(--primary) 55%, transparent) 40%, transparent 75%)',
    'linear-gradient(180deg, color-mix(in oklab, var(--foreground) 16%, transparent), color-mix(in oklab, var(--foreground) 3%, transparent))',
  ].join(', '),
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
};

/** Pointer glow inside the footer, same fallback rule as the wordmark. */
export const FOOTER_GLOW_STYLE: CSSProperties = {
  background:
    'radial-gradient(40rem 28rem at var(--fx, 70%) var(--fy, 30%), color-mix(in oklab, var(--cyan) 16%, transparent), transparent 70%)',
};
