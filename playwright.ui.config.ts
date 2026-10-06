import { defineConfig } from '@playwright/test';
import { webAppSpecPattern } from './tests/e2e/webAppSpecs';

/**
 * Visual-baseline and behaviour config for the **web app** (the `#/ui` gallery and
 * the Composer).
 *
 * Separate from `playwright.config.ts`, which serves the promo site: a spec that drives
 * the Composer cannot pass there, because the Composer does not exist there.
 *
 * The spec list is shared with that config via `tests/e2e/webAppSpecs.ts` — see the
 * comment there for why it is one list and not two.
 *
 * Usage: `npm run ui:shots`
 * Output: `tests/e2e/__screenshots__/` (gitignored; review the PNGs by hand
 * before declaring a UI PR done — 003 §11).
 */
export default defineConfig({
  testDir: './tests/e2e',
  // `project-store` is here rather than in `playwright.config.ts` because it needs
  // the **web app**, not the promo page: the claims it settles are about
  // IndexedDB in a real engine — a round trip, a payload past the 5.101 KB
  // `localStorage` ceiling, and survival across a closed tab — and none of that
  // exists on the promo site.
  testMatch: webAppSpecPattern,
  webServer: {
    command: process.env.CI
      ? 'npm run preview --workspace=@iconcore/web -- --host 127.0.0.1 --port 4182'
      : 'npm run build:web && npm run preview --workspace=@iconcore/web -- --host 127.0.0.1 --port 4182',
    url: 'http://127.0.0.1:4182/icon-core/app/',
    reuseExistingServer: false,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4182'
  }
});
