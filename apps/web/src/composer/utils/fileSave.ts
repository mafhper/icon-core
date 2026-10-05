/**
 * `FileHandle` — o vinculo entre o projeto aberto e o arquivo em disco.
 *
 * ## O que existe hoje, e o que falta
 *
 * O store (`projectStore.ts`) tem `handle?: FileSystemFileHandle` no tipo, e **nada
 * popula o campo**. O unico caminho que escreve um arquivo e `downloadProject`, que
 * baixa um `.json` novo a cada `Ctrl+S` — e por isso "Salvar" produz um arquivo
 * diferente do que o dono esperava.
 *
 * Este modulo tem a decisao, sem o `showOpenFilePicker`/`showSaveFilePicker`: o picker
 * precisa de gesto do usuario e de dialogo nativo, e **Playwright nao dirige nenhum dos
 * dois**. O que fica aqui e a parte testavel — decidir **qual** handle usar e dizer o
 * que aconteceu.
 *
 * ## Por que `Save` e `Save as` nao sao o mesmo codigo
 *
 * `Save` reescreve o handle que ja pertence ao projeto. `Save as` pede um handle novo e
 * **substitui** a ligacao. Se os dois fossem um `save(handle?)`, o `Save` acabaria
 * abrindo um dialogo — que e exatamente o defeito que o dono reportou, invertido.
 *
 * ## O contrato que o FSA impoe, e que o codigo precisa respeitar
 *
 * 1. `queryPermission` responde `prompt` apos a sessao: o handle sobrevive ao reload
 *    mas a **permissao** nao sobrevive sozinha.
 * 2. `requestPermission` **exige gesto do usuario**. Um `Save` disparado por um autosave
 *    nunca pode chamar isto, porque nao ha gesto — e e por isso que o autosave continua
 *    no IndexedDB e **nao** escreve em disco.
 * 3. `createWritable` substitui o arquivo inteiro. `write` sem `close` deixa o arquivo
 *    truncado: o `close` no `finally` e o que garante que ele existe.
 */

export interface FileHandleLike {
  readonly name: string;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export type SaveKind = 'save' | 'save-as';

export type SaveResult =
  /** O arquivo foi reescrito. **Autoriza** limpar o dirty. */
  | { kind: 'saved'; fileName: string; how: SaveKind }
  /** Nada foi escrito; o projeto **continua** sem salvar. */
  | { kind: 'skipped'; reason: 'no-project' | 'no-handle' }
  /**
   * A permissão precisa de um gesto. O `reason` diz se basta um clique em Salvar
   * (o gesto é o próprio clique) ou se é preciso ir em "Save as" — que é a diferença
   * entre "não consegui" e "não posso".
   */
  | { kind: 'needs-permission'; fileName: string; retryAs: SaveKind }
  /** O picker foi dispensado pela pessoa. Não é erro. */
  | { kind: 'cancelled' }
  /** O handle existe mas a escrita falhou. O dirty **fica**. */
  | { kind: 'failed'; fileName: string; error: string };

/** O FSA não existe em todo lugar; e Firefox não o tem. A ausência é o caso comum. */
export const supportsFileSystemAccess = (scope: unknown = globalThis): boolean =>
  typeof (scope as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function' &&
  typeof (scope as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';

/**
 * Grava o documento no handle e **sempre fecha o writable**.
 *
 * O `close` no `finally` não é paranoid: `createWritable` abre um arquivo temporário e
 * só o `close` promove. Uma escrita que lança antes do `close` deixa o original
 * truncado — que é perda de trabalho, não um erro passageiro.
 */
export const writeThroughHandle = async (
  handle: FileHandleLike,
  json: string
): Promise<{ ok: true } | { ok: false; error: string }> => {
  let writable: Awaited<ReturnType<FileHandleLike['createWritable']>> | null = null;
  try {
    writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return { ok: true };
  } catch (error) {
    const name = (error as { name?: string }).name ?? 'erro';
    // Best effort: fechar um writable já falhado pode lançar de novo, e um erro
    // secundário aqui esconderia o erro real da escrita.
    await writable?.close().catch(() => undefined);
    return { ok: false, error: name };
  }
};

/**
 * Decide o que `Save` faz, sem abrir picker nenhum.
 *
 * Separado de propósito: esta função é pura em relação ao FSA e é o que o teste
 * consegue cobrir de verdade. O picker entra **fora**, no chamador, porque ele precisa
 * de gesto do usuário.
 */
export const planSave = async (
  project: unknown,
  handle: FileHandleLike | null | undefined
): Promise<SaveResult> => {
  if (!project) return { kind: 'skipped', reason: 'no-project' };
  if (!handle) return { kind: 'skipped', reason: 'no-handle' };

  const fileName = handle.name;

  if (handle.queryPermission) {
    // Uma handle de teste, ou um engine que lanca, resolve para `prompt`: e o estado
    // conservador, porque pedir permissao e sempre seguro e falhar a save nao e.
    const state = await handle
      .queryPermission({ mode: 'readwrite' })
      .catch(() => 'prompt' as PermissionState);

    if (state === 'prompt') {
      // `requestPermission` exige gesto. Num `Ctrl+S` pressionado **há** gesto, então
      // `retryAs: 'save'` é honesto; num autosave não há, e é por isso que o autosave
      // não chega aqui.
      return { kind: 'needs-permission', fileName, retryAs: 'save' };
    }
    if (state === 'denied') {
      return { kind: 'needs-permission', fileName, retryAs: 'save-as' };
    }
  }

  const json = JSON.stringify(project, null, 2);
  const escrito = await writeThroughHandle(handle, json);
  if (!escrito.ok) return { kind: 'failed', fileName, error: escrito.error };

  return { kind: 'saved', fileName, how: 'save' };
};