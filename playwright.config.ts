import { defineConfig } from '@playwright/test';
import { webAppTestIgnore } from './tests/e2e/webAppSpecs';

export default defineConfig({
  testDir: './tests/e2e',
  /**
   * Os specs do **app** nao rodam aqui — este config sobe a landing page, onde o
   * Composer nao existe.
   *
   * A lista vem de `webAppSpecs.ts`, e antes vivia **duplicada** neste arquivo e no
   * `playwright.ui.config.ts`. Duplicada e o mesmo que repetido: o `project-store`
   * entrou num lado, esquecido no outro, passou localmente (porque o config certo foi
   * passado a mao) e quebrou no primeiro CI. Um spec so passa quando a pessoa lembra
   * de nomear o config — e isso e um spec rodando no lugar errado.
   *
   * Este e o **mesmo episodio, de novo**, com cinco specs novos. Um guard nao teria
   * pego: a lista e um regex, e nao um invariant. A correcao estrutural e a lista unica.
   */
  testIgnore: webAppTestIgnore,
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
