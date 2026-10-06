import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * O leitor de disco para `hasBundledFile`, em um modulo proprio.
 *
 * ## Por que nao inline no spec
 *
 * O `tsconfig` de `packages/iconcore-renderer` nao inclui os tipos de Node, entao um
 * `import ... from 'node:fs'` direto no `.spec.ts` e um `TS2307`. Este arquivo existe
 * porque o tsconfig **de teste** aceita, e porque o caminho precisa ser resolvido a partir
 * da raiz do repositorio.
 *
 * ## Por que a raiz vem deste arquivo, e nao do cwd
 *
 * O vitest roda com o cwd no **package** (`packages/iconcore-renderer`), entao um caminho
 * relativo de repositorio resolveria a partir dali e `assets/fonts/CalSans-Regular.woff2`
 * nao existiria — que foi exatamente o que aconteceu na primeira versao do spec: o teste
 * falhou medindo o caminho, nao a fonte. A ancora e um `import.meta.url`, que nao muda
 * entre runners.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** `exists` ancorado na raiz, para injetar em `hasBundledFile`. */
export const existeNaRaiz = (rel: string): boolean => existsSync(path.join(RAIZ, rel));

/** A raiz, para o spec montar mensagens que citem o caminho real. */
export { RAIZ };
