import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The gallery captures, the inspector layout contract and the IndexedDB store
  // belong to `ui:shots` (playwright.ui.config.ts, web server) - they must not run
  // against the promo server here, where the app does not exist.
  //
  // `project-store` joined that list when it was added, and CI caught the omission:
  // it passed locally because the right config was passed by hand, and failed on the
  // first CI run because `npm run test:e2e` uses this file. A spec that only passes
  // when you remember to name its config is a spec that runs in the wrong place.
  testIgnore: /(ui-gallery|inspector-layout|polish|project-store)\.spec\.ts/,
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
