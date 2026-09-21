import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The gallery captures and the inspector layout contract belong to `ui:shots`
  // (playwright.ui.config.ts, web server) — they must not run against the promo
  // server here, where the app does not exist.
  testIgnore: /(ui-gallery|inspector-layout)\.spec\.ts/,
  webServer: {
    command: process.env.CI
      ? 'npm run preview --workspace=@iconcore/promo -- --host 127.0.0.1 --port 4181'
      : 'npm run build:promo && npm run preview --workspace=@iconcore/promo -- --host 127.0.0.1 --port 4181',
    url: 'http://127.0.0.1:4181/icon-core/',
    reuseExistingServer: false,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4181'
  }
});
