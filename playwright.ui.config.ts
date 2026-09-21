import { defineConfig } from '@playwright/test';

/**
 * Visual-baseline config for the `#/ui` component gallery (A4).
 *
 * Separate from `playwright.config.ts` (which serves the promo site): this
 * serves the **web app** preview build and captures the gallery at
 * desktop/narrow widths × dark/light themes.
 *
 * Usage: `npm run ui:shots`
 * Output: `tests/e2e/__screenshots__/` (gitignored; review the PNGs by hand
 * before declaring a UI PR done — 003 §11).
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /ui-gallery\.spec\.ts/,
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
