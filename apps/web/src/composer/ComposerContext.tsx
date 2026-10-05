import { createContext, useCallback, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  composerReducer,
  initialState,
  normalizeRoute,
  type ComposerState,
  type ComposerAction,
  type ComposerView
} from './composerReducer';
import { describeSaveOutcome, downloadProject, projectFileName } from './utils/projectStorage';
import {
  openWithFileSystemAccess,
  saveProjectInPlace,
  saveProjectWithFileSystemAccess
} from './utils/projectFiles';
import { parseProjectFile } from './utils/projectGuard';
import {
  openProjectStore,
  readPointer,
  writePointer,
  type ProjectPointer,
  type ProjectStore
} from './utils/projectStore';
import { useToast } from './toast/ToastContext';

/**
 * Where the open project lives, and how it gets there.
 *
 * **What changed with `D1`.** The autosave used to write one `localStorage` slot
 * synchronously, and the provider restored from it while rendering — which is why
 * reopening the app went straight to the editor with no flash. IndexedDB is
 * **asynchronous**, so that trick is gone: the open is now a step the provider has
 * to wait for, and the first render happens before the project is known.
 *
 * **The phase is the whole design.** `restoring` exists so the app can say *"we
 * are getting your project"* rather than flashing an empty editor and then filling
 * it. The alternative — optimistically rendering the editor and swapping the
 * project in a moment later — is what makes an app feel broken, and it is exactly
 * the false-belief failure the quota fix (#197) was about, one level up.
 *
 * **Nothing here can block the editor for long.** `openProjectStore` never rejects:
 * an unreadable pointer, a storage that throws on `getItem`, a blocked IndexedDB and
 * a legacy slot that fails to parse all resolve to "start from an empty workspace",
 * because a project the user cannot open is worth less than an editor they can use.
 */

interface ComposerContextValue {
  state: ComposerState;
  dispatch: React.Dispatch<ComposerAction>;
  navigate: (view: ComposerView) => void;

  // --- `D2`: the list of stored projects -----------------------------------
  //
  // The welcome needs to answer "is there something to continue, and what is it?",
  // and the store is the only thing that knows. It lives here rather than in the
  // modal because **the modal must not open its own IndexedDB connection** — two
  // connections to one database is how you get a blocked upgrade and a version
  // change that silently never completes.
  storedProjects: ProjectPointer[];
  projectsLoading: boolean;
  /** Re-reads the list. Called when the welcome opens, not on every autosave. */
  refreshProjects: () => Promise<void>;
  /** Opens a stored project, keeping its storage id so the autosave writes back to it. */
  openStoredProject: (id: string) => Promise<boolean>;
  removeStoredProject: (id: string) => Promise<void>;
  /** Renames in the stored document, not just in the list. */
  renameStoredProject: (id: string, name: string) => Promise<boolean>;
  /**
   * O handle do arquivo aberto, e `true` enquanto houver um.
   *
   * Vive aqui e nao no `Topbar` porque **precisa sobreviver a fechar e reabrir a aba**:
   * o handle e *structured-cloneable*, entao o store o guarda no IndexedDB e o `Salvar`
   * volta a gravar no arquivo certo sem a pessoa escolher de novo. Em `useRef` do
   * `Topbar` ele viveria enquanto a aba vivesse, e o "salvar no lugar" viraria "salvar
   * como" silenciosamente na sessao seguinte.
   */
  fileHandle: FileSystemFileHandle | null;
  /**
   * Guarda (ou limpa) o handle do projeto `id`. `null` desliga — usado quando o projeto
   * foi aberto por `<input type="file">`, que nao devolve handle.
   *
   * Devolve `false` quando o store nao aceitou (o `localStorage` de reserva nao guarda
   * handle, e engines que nao tratam objetos de plataforma recusam o clone). O chamador
   * **nao** trata isso como erro: e o mesmo estado de um projeto sem arquivo, e o item
   * do menu avisa.
   */
  attachFileHandle: (id: string, handle: FileSystemFileHandle | null) => Promise<boolean>;
  /**
   * `Salvar`: grava no arquivo **aberto**.
   *
   * Sem handle, cai para `saveProjectAs` e **avisa** — porque "Salvar" virando "Salvar
   * como" em silencio faria a pessoa criar um segundo arquivo sem perceber e continuar
   * editando o primeiro.
   */
  saveProject: () => Promise<void>;
  /**
   * `Salvar como`: **oferece** o seletor de destino.
   *
   * Sem File System Access (Firefox, ou contexto nao seguro), cai para o download e avisa
   * — download e um caminho de reserva, nao o que o rotulo promete.
   */
  saveProjectAs: () => Promise<void>;
  /** Abre um projeto, preferindo o FSA para poder gravar nele depois. */
  openProjectFile: () => Promise<void>;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

/**
 * The synchronous half of the restore: what the pointer alone can tell us.
 *
 * The pointer is a UUID and a name in `localStorage`, readable during render. It is
 * what lets the app know *whether* a saved project exists before the body arrives,
 * which is the difference between "opening your project" and "here is an empty
 * canvas, sorry".
 */
const peekPointerName = (): string | null => readPointer(window.localStorage)?.name ?? null;

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const toast = useToast();

  const [restoring, setRestoring] = useState(true);
  const [restoredName, setRestoredName] = useState<string | null>(() => peekPointerName());

  // Read once, before the first paint, so the reducer never starts from a half-known
  // project. `useRef` rather than state because it must not trigger a render.
  const restoreRef = useRef<{ init: ComposerState; name: string | null } | null>(null);
  if (restoreRef.current === null) {
    restoreRef.current = { init: initialState, name: restoredName };
  }

  const [state, dispatch] = useReducer(composerReducer, restoreRef.current.init);

  // The store outlives any single save, so it lives in a ref rather than in state:
  // putting it in state would make every save re-render the whole composer tree.
  const storeRef = useRef<ProjectStore | null>(null);
  // Autosave writes can finish out of order. This counter is what makes "the last
  // write wins" true rather than hopeful: a stale result is recognised and ignored
  // instead of clearing `isDirty` for work that was never stored.
  const writeSeqRef = useRef(0);
  const quotaAvisadaRef = useRef(false);

  // Declared before the store-open effect on purpose: that effect writes this state,
  // and a `const` referenced from an effect body works only because the body runs after
  // the component finished. Correct, and a trap for whoever moves one line.
  const [storedProjects, setStoredProjects] = useState<ProjectPointer[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  /**
 * O handle do arquivo aberto, em `state` e nao em ref.
 *
 * Ele precisa **re-renderizar** quem mostra o estado do `Salvar` — e um ref nao faria.
 * O objeto em si e um handle de plataforma (barato de guardar); o re-render so acontece
 * em "Abrir" e em "Salvar como", que sao acoes raras.
 */
const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);


  useEffect(() => {
    let vivo = true;

    openProjectStore({ storage: window.localStorage, factory: window.indexedDB ?? null })
      .then(({ store, pointer }) => {
        if (!vivo) return;
        storeRef.current = store;

        // **The list is read here, where the store is known to exist** — not by the
        // welcome on its mount.
        //
        // The first version did the opposite and the list never appeared on a cold
        // start: `openProjectStore` is async, the welcome is the very first thing to
        // mount when there is no project, so `refreshProjects` ran while
        // `storeRef.current` was still `null`, returned early, and was never called
        // again. One project on disk, an empty list, no error anywhere. The tests missed
        // it because every one of them saved a project first, which is exactly the
        // await the cold-start path skips.
        store
          .list()
          .then((projects) => {
            if (vivo) setStoredProjects(projects);
          })
          .catch(() => {
            // A list that fails to load is an empty list, not a broken welcome: the
            // three creation paths do not depend on it.
            if (vivo) setStoredProjects([]);
          });

        if (!pointer) {
          setRestoredName(null);
          setRestoring(false);
          return;
        }

        setRestoredName(pointer.name);

        return store.read(pointer.id).then((found) => {
          if (!vivo) return;
          if (!found) {
            // The pointer named something the store cannot produce. The store has
            // already fallen back to wherever the project actually is, so the honest
            // outcome is an empty workspace with the name still offered — the user
            // picks "New" and keeps going.
            setRestoring(false);
            return;
          }
          dispatch({ type: 'LOAD_PROJECT', payload: { project: found.project, projectId: found.id } });
          /**
           * O handle **volta** para o estado, e esta linha e o que separa "Salvar" de
           * "Salvar como".
           *
           * Sem ela, o handle fica guardado no store e nunca e lido: `fileHandle`
           * ficava `null` depois de qualquer reload, e o `Salvar` caia no
           * `saveProjectAs` — os dois botoos abriam o mesmo seletor. Foi exatamente
           * isso que o dono reportou: "Salvar e Salvar as esta fazendo a mesma coisa".
           *
           * `found.handle` vem do proprio `store.read`, que ja sabe clonar handle de
           * plataforma; nao ha nada a pedir aqui alem de **usar**.
           */
          if (found.handle) setFileHandle(found.handle);
          setRestoring(false);
        });
      })
      .catch((error: unknown) => {
        // `openProjectStore` is written not to reject. Reaching here means a defect
        // in it, and swallowing that silently would be the same false belief the
        // quota fix removed.
        if (!vivo) return;
        console.warn('Could not open the project store:', error);
        setRestoring(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (restoring) return;
    if (!state.project || !state.isDirty) return;

    const timer = setTimeout(() => {
      const store = storeRef.current;
      const project = state.project;
      const id = state.projectId;
      if (!store || !project || !id) return;

      const seq = ++writeSeqRef.current;
      const name = project.metadata.name;

      /**
   * O `write` do store e um **`put`**: o registro e substituido inteiro.
   *
   * Passar `{ id, name, project }` sem o handle **apaga o vinculo com o arquivo** a cada
   * autosave — e o autosave dispara dois segundos apos qualquer edicao. O efeito era:
   * abrir um projeto pelo File System Access, esperar o autosave, e o "Salvar no lugar"
   * ja tinha virado "Salvar como". Sem erro, sem aviso, e com o handle no disco.
   *
   * Por isso o `fileHandle` entra no payload. O `write` continua substituting o registro
   * (nao virou read-modify-write), e quem decide o que vai no registro e quem o tem.
   */
  void store.write({ id, name, project, handle: fileHandle ?? undefined }).then((outcome) => {
        if (seq !== writeSeqRef.current) return; // a newer write already answered

        if (outcome.kind === 'saved') {
          // The pointer follows whichever project was saved last, which is the one
          // the editor is showing. It is written only on success, so a refused save
          // cannot point the next session at work that was never stored.
          writePointer(window.localStorage, { id, name, updatedAt: Date.now() });
          dispatch({ type: 'SET_DIRTY', payload: false });
          return;
        }

        const aviso = describeSaveOutcome(outcome);
        if (aviso && !quotaAvisadaRef.current) {
          quotaAvisadaRef.current = true;
          toast.error(aviso);
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
// `state.projectId` is a real dependency, not a formality: a new project keeps a
    // new id, and if the effect ignored it a replacement that arrived already dirty
    // would be written under the **previous** project's key - the same silent
    // overwrite, one effect later.
    //
    // `fileHandle` e dependencia pelo mesmo motivo e mais forte: o `write` substitui o
    // registro, entao um handle trocado (por um "Salvar como") precisa entrar no payload
    // do proximo autosave, ou o vinculo com o arquivo volta a ser o antigo.
  }, [state.project, state.projectId, state.isDirty, restoring, toast, fileHandle]);

  // The autosave keeps failing after the first notice, so the flag is what keeps
  // one full project from producing a toast on every keystroke. It clears when the
  // project fits again, which is the only time the situation has changed.
  useEffect(() => {
    if (!state.isDirty) quotaAvisadaRef.current = false;
  }, [state.isDirty]);

  /**
   * `beforeunload`: fechar ou recarregar com trabalho nao salvo.
   *
   * ## Por que este hook existe
   *
   * O IndexedDB guarda o projeto a cada 2 s, entao recarregar **nao perde** o desenho —
   * e essa e exatamente a razao pela qual o aviso e necessario e nao opcional: sem ele,
   * fechar a aba parece seguro e a pessoa nao sabe que o que reopen e um *recover*,
   * nao o arquivo. O `exploracao-openpencil` (`tests/e2e/app/unsaved-changes.spec.ts`,
   * "browser reload warns about unsaved work") tem o mesmo hook, pelo mesmo motivo.
   *
   * ## Por que `event.preventDefault()` e nao `event.returnValue`
   *
   * Porque `returnValue` e o caminho legado e dispara aviso de deprecacao no Chromium;
   * `preventDefault` e a forma moderna e produz o mesmo dialogo. Firefox exige
   * `returnValue` — por isso os dois, e e o unico lugar onde isso e justificavel.
   *
   * ## Por que so quando ha projeto **e** dirty
   *
   * Um aviso de "tem trabalho nao salvo" num app aberto sem projeto ensinaria a pessoa a
   * clicar em "Sair" sem ler. O aviso que aparece sempre deixa de aparecer.
   */
  useEffect(() => {
    if (!state.project || !state.isDirty) return;
    const aoSair = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [state.project, state.isDirty]);

  useEffect(() => {
    const handleHashChange = () => {
      const raw = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      const view = normalizeRoute(raw);
      if (raw === 'composer' || raw === 'compose' || raw === 'start' || raw === 'export') {
        window.history.replaceState(null, '', `#/` + view);
      }
      dispatch({ type: 'NAVIGATE', payload: view });
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0, behavior: 'auto' }));
  }, [state.view]);

  const navigate = useCallback((view: ComposerView) => {
    if (window.location.hash !== `#/${view}`) {
      window.location.hash = `/${view}`;
      return;
    }
    dispatch({ type: 'NAVIGATE', payload: view });
  }, []);

  // --- `D2`: the stored-project list ---------------------------------------

  const refreshProjects = useCallback(async () => {
    const store = storeRef.current;
    // The list is already loaded by the store-open effect, so reaching this before the
    // store exists means the open has not landed yet — and it will load the list on its
    // own. Skipping here is therefore correct, and no longer the bug it used to be.
    if (!store) return;
    setProjectsLoading(true);
    try {
      setStoredProjects(await store.list());
    } catch {
      setStoredProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const openStoredProject = useCallback(
    async (id: string) => {
      const store = storeRef.current;
      if (!store) return false;
      const found = await store.read(id);
      if (!found) return false;
      // The record's own id, so the autosave writes back to the record it came from
      // instead of minting a second copy of the project the user just opened.
      dispatch({ type: 'LOAD_PROJECT', payload: { project: found.project, projectId: found.id } });
      // Mesmo ponto do restore-on-mount: sem repor o handle, "Salvar" e "Salvar como"
      // continuam sendo o mesmo botao para quem abriu o projeto pela lista.
      if (found.handle) setFileHandle(found.handle);
      navigate('edit-space');
      return true;
    },
    [navigate]
  );

  const attachFileHandle = useCallback(
    async (id: string, handle: FileSystemFileHandle | null) => {
      setFileHandle(handle);
      const store = storeRef.current;
      // Sem store aberto nao ha onde guardar; o estado da sessao continua valendo, entao
      // isto **nao** e erro.
      if (!store) return false;
      return store.setHandle(id, handle);
    },
    []
  );

  const saveProject = useCallback(async () => {
    if (!state.project) return;
    if (!fileHandle) {
      await saveProjectAsRef.current?.();
      return;
    }
    // `requestPermission` **exige gesto do usuario** — e um clique no menu ou um
    // `Ctrl+S` e um gesto. E por isso que o autosave nunca chega aqui: ele nao tem
    // gesto, e por isso continua no IndexedDB.
    const r = await saveProjectInPlace(state.project, fileHandle);
    if (r.kind === 'saved') {
      dispatch({ type: 'SET_DIRTY', payload: false });
      toast.success(`Saved to ${r.fileName}`);
      return;
    }
    if (r.kind === 'needs-permission') {
      const pedido = fileHandle as unknown as {
        requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
      };
      if ((await pedido.requestPermission?.({ mode: 'readwrite' })) !== 'granted') {
        toast.error('Icon Core needs permission to write to that file.');
        return;
      }
      const segunda = await saveProjectInPlace(state.project, fileHandle);
      if (segunda.kind === 'saved') {
        dispatch({ type: 'SET_DIRTY', payload: false });
        toast.success(`Saved to ${segunda.fileName}`);
      } else {
        toast.error('Could not write to the file.');
      }
      return;
    }
    if (r.kind === 'failed') {
      toast.error(`Could not write to ${r.fileName}.`);
      return;
    }
    toast.error('Nothing was written.');
  }, [state.project, fileHandle, toast, dispatch]);

  /**
   * `saveProject` precisa chamar `saveProjectAs`, e os dois nao podem se declarar
   * juntos: um chamaria o outro antes de existir. O ref quebra o ciclo sem duplicar o
   * corpo — e a alternativa (duplicar) e exatamente o defeito que o `Salvar como`
   * sofreu.
   */
  const saveProjectAsRef = useRef<(() => Promise<void>) | null>(null);

  const saveProjectAs = useCallback(async () => {
    if (!state.project) return;
    const nome = projectFileName(state.project.metadata.name);
    const r = await saveProjectWithFileSystemAccess(state.project, nome);
    if (r.kind === 'saved') {
      // A partir daqui o handle **novo** e o que o `Salvar` usa: e este ciclo que faz
      // "Salvar como" valer para as gravacoes seguintes.
      if (state.projectId) await attachFileHandle(state.projectId, r.handle as FileSystemFileHandle);
      dispatch({ type: 'SET_DIRTY', payload: false });
      toast.success(`Saved to ${r.fileName}`);
      return;
    }
    if (r.kind === 'cancelled') return;
    if (r.kind === 'unsupported') {
      const baixado = downloadProject(state.project);
      if (baixado.kind === 'downloaded') {
        dispatch({ type: 'SET_DIRTY', payload: false });
        /**
         * **Sticky**, e nao `toast.info`.
         *
         * "Este browser nao escreve no lugar, os arquivos sao baixados" continua verdade
         * depois de 4,5 s — e a pessoa vai descobrir de novo no proximo `Ctrl+S`. Um
         * aviso que expira e um aviso que a pessoa perde.
         *
         * O `exploracao-openpencil` resolve o mesmo fato com um banner persistente
         * (`FileApiBanner.vue`, que mostra a capacidade do browser em vez do resultado
         * de uma acao). Aqui o aviso nasce do **resultado** — que e quando a pessoa
         * pode agir sobre ele — e fica ate ela dispensar.
         */
        toast.sticky('This browser cannot save in place — files are downloaded instead.');
      }
      return;
    }
    toast.error(`Could not save: ${r.reason}`);
  }, [state.project, state.projectId, attachFileHandle, toast, dispatch]);

  saveProjectAsRef.current = saveProjectAs;

  /**
   * Abrir, preferindo o FSA.
   *
   * O `<input type="file">` da reserva devolve um `File`, que e uma **copia** e nao tem
   * `createWritable` — abrir por ele torna o "Salvar no lugar" impossivel por
   * construcao. O `showOpenFilePicker` devolve o handle.
   */
  /**
   * A reserva sem File System Access: `<input type="file">`.
   *
   * Num `useCallback` porque `openProjectFile` a chama, e um `const` recreated a cada
   * render seria uma dependencia instavel de um `useCallback`.
   *
   * O preco desta via esta escrito no proprio fluxo: um `File` e uma **copia**, sem
   * `createWritable`, entao um projeto aberto assim **nao tem** "Salvar no lugar" — e o
   * item do menu passa a dizer "Save (as a new file)".
   */
  const abrirPorInput = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iconcore.json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const project = parseProjectFile(await file.text());
      if (!project) {
        toast.error(`"${file.name}" is not a valid Icon Core project file.`);
        return;
      }
      // Sem handle: este projeto **nao** tem "Salvar no lugar", e o item do menu avisa.
      if (state.projectId) void attachFileHandle(state.projectId, null);
      dispatch({ type: 'LOAD_PROJECT', payload: project });
      toast.success(`Opened ${project.metadata.name}`);
    };
    input.click();
  }, [state.projectId, attachFileHandle, toast, dispatch]);

  const openProjectFile = useCallback(async () => {
    const abriu = await openWithFileSystemAccess(parseProjectFile);
    if (abriu.kind === 'cancelled') return;
    if (abriu.kind === 'unsupported') {
      abrirPorInput();
      return;
    }
    if (abriu.kind === 'invalid') {
      toast.error(`"${abriu.fileName}" is not a valid Icon Core project file.`);
      return;
    }
    if (state.projectId) {
      await attachFileHandle(state.projectId, abriu.handle as FileSystemFileHandle);
    }
    dispatch({ type: 'LOAD_PROJECT', payload: abriu.project as never });
    const nome = (abriu.project as { metadata: { name: string } }).metadata.name;
    toast.success(`Opened ${nome}`);
  }, [state.projectId, attachFileHandle, toast, dispatch, abrirPorInput]);

  const removeStoredProject = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await store.remove(id);
    setStoredProjects((atual) => atual.filter((p) => p.id !== id));

    // Deleting the open project must not leave the pointer naming it, or the next
    // session would announce a project that no longer exists.
    const pointer = readPointer(window.localStorage);
    if (pointer?.id === id) writePointer(window.localStorage, null);
  }, []);

  const renameStoredProject = useCallback(
    async (id: string, name: string) => {
      const store = storeRef.current;
      const trimmed = name.trim();
      if (!store || !trimmed) return false;

      // A read-modify-write, because the name lives **in the document**. Renaming only
      // the list row would produce a row that disagrees with what reopening produces.
      const found = await store.read(id);
      if (!found) return false;

      const project = { ...found.project, metadata: { ...found.project.metadata, name: trimmed } };
      const outcome = await store.write({ id, name: trimmed, project });
      if (outcome.kind !== 'saved') return false;

      setStoredProjects((atual) => atual.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));

      // Keep the open project's name and the pointer in step, or the header and the
      // list would show two different names for the same project.
      if (state.projectId === id) {
        dispatch({ type: 'SET_PROJECT_NAME', payload: trimmed });
        writePointer(window.localStorage, { id, name: trimmed, updatedAt: Date.now() });
      }
      return true;
    },
    [state.projectId]
  );

  return (
    <ComposerContext.Provider
      value={{
        state,
        dispatch,
        navigate,
        storedProjects,
        projectsLoading,
        refreshProjects,
        openStoredProject,
        removeStoredProject,
        renameStoredProject,
        fileHandle,
        attachFileHandle,
        saveProject,
        saveProjectAs,
        openProjectFile
      }}
    >
      {/* Announced, not decorative: this is the one moment the app is deliberately
          not showing the work, and a screen reader user is owed the same fact a
          sighted one gets from the wait.

          Tailwind utilities, not a new class, for a reason worth stating: the UI
          budget guard has five lines of CSS left and one hex literal, and its policy
          is that budgets never go up. `bg-ic-surface` and `text-ic-text-muted`
          resolve through the existing `@theme` mapping, so this costs zero CSS lines
          and zero literals — and the colour guard stays measurable, because a raw
          hex here would have been the 97th. */}
      {restoring && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-ic-surface text-ic-text-muted"
        >
          {restoredName ? `Opening ${restoredName}…` : 'Opening your workspace…'}
        </div>
      )}
      {children}
    </ComposerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- The context hook belongs to this provider module.
export const useComposer = (): ComposerContextValue => {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within ComposerProvider');
  return ctx;
};
