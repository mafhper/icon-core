import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: process.env.CI
      ? 'bun run --filter @iconcore/promo preview --host 127.0.0.1 --port 4181'
      : 'bun run build:promo && bun run --filter @iconcore/promo preview --host 127.0.0.1 --port 4181',
    url: 'http://127.0.0.1:4181/icon-core/',
    reuseExistingServer: false,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4181'
  }
});
