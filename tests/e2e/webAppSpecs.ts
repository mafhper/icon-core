/**
 * Os specs que rodam contra o **app**, nao contra a landing page.
 *
 * ## Por que este arquivo existe
 *
 * `playwright.config.ts` (a promo) e `playwright.ui.config.ts` (o app) apontam para o
 * mesmo `tests/e2e/`, e cada um precisa saber quais specs sao suas. A lista vivia
 * duplicada em `testMatch` e `testIgnore` — e duplicada e o mesmo que repetido: o
 * `project-store` entrou num lado e esquecido no outro, passou localmente (porque o
 * config certo foi passado a mao) e **quebrou no primeiro CI**. O `testIgnore` do
 * config da promo documenta o episodio em comentario.
 *
 * Entao a lista mora aqui, e os dois config importam. Um spec novo do app entra em um
 * lugar so, e os dois lados concordam por construcao.
 *
 * ## O criterio
 *
 * Um spec e do **app** quando ele dirige o Composer: canvas, inspetor, layers, store.
 * Um spec e da **promo** quando ele dirige a landing page. A lista abaixo e o app.
 *
 * Para promover um spec da promo para o app (ou criar novo), acrescente o nome aqui —
 * nao nos dois arquivos.
 */

/**
 * Nomes dos specs do app, sem extensao, como um unico padrao.
 *
 * Sem a extensao porque os dois usos sao diferentes: `testMatch` casa o nome inteiro
 * e `testIgnore` precisa casar tambem `tests/e2e/<nome>.spec.ts`. Um padrao so, com
 * `\.spec\.ts` no fim, serve para os dois.
 */
export const WEB_APP_SPECS = [
  'ui-gallery',
  'inspector-layout',
  'polish',
  'project-store',
  'mask-radius',
  'radius-marks',
  'margin-overlay',
  'grid-config',
  'keyline-config',
  'layer-reorder',
  'export-preview',
  'font-picker',
  'preview-fidelity',
  'layer-drag',
  'text-panel',
  'foreignobject-regression',
  'storage-isolation'
] as const;

/**
 * Para `playwright.ui.config.ts` (`testMatch`).
 *
 * O mesmo padrao serve para `testIgnore` no config da promo: `testIgnore` e testado
 * contra o caminho completo do arquivo, mas casa porcao, entao `grid-config.spec.ts`
 * dentro de `tests/e2e/` casa do mesmo jeito. Um so padrao, e nao dois — dois iguais
 * seria a mesma duplicacao que este arquivo veio eliminar.
 */
export const webAppSpecPattern = new RegExp(`(${WEB_APP_SPECS.join('|')})\\.spec\\.ts`);

/** Alias semantico: o mesmo padrao, com o nome que o `testIgnore` espera. */
export const webAppTestIgnore = webAppSpecPattern;