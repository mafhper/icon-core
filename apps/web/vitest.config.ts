import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,

    /**
     * The web suite races Vitest's 5 s default on every test, and it was failing
     * intermittently. Measured on 2026-10-03 (8 cores, ~8,7 GB free):
     *
     * - `UiGallery.spec.tsx` alone, six runs: the slowest test took 1.147–1.428 s,
     *   i.e. **29% of the default**, and all six passed.
     * - 174 tests with a 60 s timeout: the slowest was 3.024 s, **60% of the
     *   default**. None reached 5 s.
     * - 88% of the isolated wall time is Vitest startup, not the test.
     * - The suite passed 5/5 on its own, under a `tsc` build, under two Chromium
     *   instances, and as the full monorepo chain. **CI has never failed this job.**
     *
     * So the test was never slow, and no timeout value prevents what actually
     * happened: a **worker stall** — a competing process, a filesystem pause, a
     * scanner pass over a freshly written `dist`.
     *
     * One bounded retry absorbs that. It is already visible: the default reporter
     * prints `(retry x1)` beside the test, so a recovered stall cannot be mistaken
     * for a healthy run. A custom reporter was tried and removed — it added
     * nothing the default did not already say.
     */
    retry: 1,

    /**
     * 15 s, not 5 s: three times the worst measured duration, so the retry is there
     * for a stall rather than for a legitimately slow test. Still short enough
     * that a genuinely hung test is reported in seconds.
     *
     * Deliberately **not** a large `testTimeout` on its own. A 60 s default lets a
     * hung test hold a worker for a minute and hides the stall instead of naming
     * it — which is the shape of debt this replaces.
     */
    testTimeout: 15000
  }
});
