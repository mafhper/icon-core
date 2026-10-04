import type { RenderBackend } from '../types';

/**
 * There is deliberately no Node backend.
 *
 * The message this used to carry said: *"wait for Phase 6 (CLI) when sharp
 * integration is added."* That was wrong twice over. `sharp` was **measured and
 * rejected** — `ADR-017` Alternative A, at 48.8% agreement on a linear gradient,
 * which is the case that matters least for an icon and most for a mesh. And the
 * CLI was never the destination: `ADR-017` §Consequences states plainly that *"the
 * CLI keeps not rasterizing. This decision is about the **build path**, not the
 * CLI."*
 *
 * So the error used to send the next person after a plan that had already been
 * rejected, on a path that had already been ruled out. It is a two-line string and
 * it was the most misleading thing in the package.
 *
 * What is actually true:
 *
 * - Rasterization happens in the **browser**, by `createCanvasBackend`.
 * - Generating assets outside it is the `scripts/` + headless Chromium harness of
 *   `IC61F`, which hosts **this same Canvas engine** — one renderer, so there is no
 *   second implementation to drift.
 * - See `.dev/decisions/ADR-017-rasterizacao-fora-do-browser.md`.
 *
 * `createNodeBackend` stays exported because it is the seam that fails loudly
 * instead of silently producing nothing: a caller reaching for a Node backend gets
 * told where rendering actually lives, rather than an empty file.
 */
export const createNodeBackend = (): RenderBackend => {
  throw new Error(
    'There is no Node render backend, by decision (ADR-017). Rendering happens in the ' +
      'browser via the Canvas backend. To generate assets outside the browser, use the ' +
      'scripts/ harness from IC61F, which hosts that same Canvas engine in headless ' +
      'Chromium — not sharp or resvg, which were measured and rejected.'
  );
};
