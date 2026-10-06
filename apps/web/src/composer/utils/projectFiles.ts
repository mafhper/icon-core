import {
  planSave,
  supportsFileSystemAccess,
  writeThroughHandle,
  type FileHandleLike,
  type SaveResult
} from './fileSave';

/**
 * Os dois comportamentos de salvar — e por que não são a mesma função.
 *
 * ## O que o dono pediu (2026-10-04)
 *
 * > "eu queria poder começar criar/editar um icone no icon-core, clicar em salvar e
 * > preservar as mudanças no arquivo aberto. caso clique em salvar como, ai sim o json é
 * > oferecido (não fazendo download automatico) ao usuario para que ele escolha onde
 * > salvar o arquivo"
 *
 * Isso são **dois** comportamentos, e a versão anterior tratava os dois como um só: o
 * `Save as…` chamava exatamente o mesmo `downloadProject` do `Save`, com o mesmo atalho
 * `Ctrl+S`. Um botão que promete uma escolha e não oferece nenhuma é pior que um botão
 * que não existe: a pessoa clica esperando um seletor e recebe um arquivo na pasta de
 * downloads, e a conclusão que ela tira é que o app perdeu o trabalho.
 *
 * ## Por que isto é um modulo e não o componente
 *
 * Porque **os dois fluxos precisam de gesto do usuário**, e o gesto vem do clique no
 * item de menu. `showOpenFilePicker`, `showSaveFilePicker` e `requestPermission`
 * dispensam se não vierem de um gesto — e nenhum dos três é automatizável: o seletor é
 * nativo, e o Playwright não o dirige. Então a parte testável fica aqui, separada do
 * `picker`, e o teste cobre a decisão sem nunca chamar o browser.
 */

export type OpenOutcome =
  | { kind: 'opened'; project: unknown; fileName: string; handle: FileHandleLike }
  /** O picker foi dispensado. Não é erro, e não deve virar aviso. */
  | { kind: 'cancelled' }
  /** O FSA não existe (Firefox, ou contexto não seguro). O chamador cai para `<input>`. */
  | { kind: 'unsupported' }
  | { kind: 'invalid'; fileName: string; reason: string };

export type SaveAsOutcome =
  | { kind: 'saved'; fileName: string; handle: FileHandleLike }
  | { kind: 'cancelled' }
  | { kind: 'unsupported' }
  | { kind: 'failed'; fileName: string; reason: string };

/** A parte do FSA que só existe no browser, isolada para poder ser trocada no teste. */
export interface FileSystemAccessScope {
  showOpenFilePicker?: (options?: unknown) => Promise<FileHandleLike[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileHandleLike>;
}

const scopeOf = (provided?: FileSystemAccessScope): FileSystemAccessScope =>
  provided ?? (globalThis as unknown as FileSystemAccessScope);

/**
 * Abre um projeto pelo File System Access, **guardando o handle**.
 *
 * ## Por que `showOpenFilePicker` e não `<input type="file">`
 *
 * Porque `<input type="file">` dá um `File` — que é uma **cópia**, e não tem
 * `createWritable`. Abrir por ele torna o "Salvar no lugar" impossível por
 * construção: não há o que gravar. O `FileSystemFileHandle` é o objeto de plataforma
 * que sabe gravar no mesmo caminho, e a única forma de obter um é um picker com gesto.
 *
 * É por isso que `openProject` no `Topbar` ainda usa `<input>` como reserva: ele
 * funciona onde o FSA não existe, e o preço é justamenteprecisamente perder o
 * "Salvar no lugar".
 */
export const openWithFileSystemAccess = async (
  parse: (text: string) => unknown | null,
  scope?: FileSystemAccessScope
): Promise<OpenOutcome> => {
  const fs = scopeOf(scope);
  if (!supportsFileSystemAccess(fs)) return { kind: 'unsupported' };

  let picked: FileHandleLike;
  try {
    const [handle] = await fs.showOpenFilePicker!({
      types: [{ description: 'Icon Core project', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    picked = handle;
  } catch {
    // `AbortError` é o dispensar. Qualquer outra coisa também é "não conseguiu", e
    // tratar os dois como dispensar evita um aviso para um erro que o chamador não
    // tem como corrigir.
    return { kind: 'cancelled' };
  }

  let text: string;
  try {
    const file = await (picked as unknown as { getFile(): Promise<File> }).getFile();
    text = await file.text();
  } catch (error) {
    return {
      kind: 'invalid',
      fileName: picked.name,
      reason: (error as { name?: string }).name ?? 'erro'
    };
  }

  const project = parse(text);
  if (!project) return { kind: 'invalid', fileName: picked.name, reason: 'formato' };

  return { kind: 'opened', project, fileName: picked.name, handle: picked };
};

/**
 * `Save as`: **oferece** o arquivo ao usuário escolher onde.
 *
 * ## A diferença que importa, e que custou um defeito
 *
 * A versão anterior chamava `downloadProject` aqui — que **baixa** um arquivo. O rótulo
 * dizia "Save as…" e o comportamento era "baixa com outro nome", o que é falso nos dois
 * sentidos: não há escolha de lugar, e o arquivo original continua intocado sem que
 * ninguém diga nada.
 *
 * `showSaveFilePicker` abre o seletor **declarado pela plataforma**, e quem decide é a
 * pessoa. Se ela confirmar, o handle novo substitui o antigo no store — e a partir
 * dali `Salvar` grava naquele caminho.
 */
export const saveProjectWithFileSystemAccess = async (
  project: unknown,
  suggestedName: string,
  scope?: FileSystemAccessScope
): Promise<SaveAsOutcome> => {
  const fs = scopeOf(scope);
  if (!supportsFileSystemAccess(fs)) return { kind: 'unsupported' };

  let handle: FileHandleLike;
  try {
    handle = await fs.showSaveFilePicker!({
      suggestedName,
      types: [{ description: 'Icon Core project', accept: { 'application/json': ['.json'] } }]
    });
  } catch {
    return { kind: 'cancelled' };
  }

  const escrito = await writeThroughHandle(handle, JSON.stringify(project, null, 2));
  if (!escrito.ok) return { kind: 'failed', fileName: handle.name, reason: escrito.error };

  return { kind: 'saved', fileName: handle.name, handle };
};

/**
 * `Save`: grava no arquivo **já aberto**.
 *
 * Reexportado de `fileSave.planSave` em vez de reimplementado, porque a decisão
 * (permissão pendente, handle ausente, falha de disco) já tem 9 testes lá e uma segunda
 * cópia divergiria no primeiro ajuste.
 */
export const saveProjectInPlace = planSave;

/** Reexportado para o chamador não precisar conhecer os dois módulos. */
export type { FileHandleLike, SaveResult };