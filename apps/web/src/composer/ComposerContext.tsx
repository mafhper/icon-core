import { createContext, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  composerReducer,
  initialState,
  normalizeRoute,
  type ComposerState,
  type ComposerAction,
  type ComposerView
} from './composerReducer';
import { describeSaveOutcome } from './utils/projectStorage';
import {
  openProjectStore,
  readPointer,
  writePointer,
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

  useEffect(() => {
    let vivo = true;

    openProjectStore({ storage: window.localStorage, factory: window.indexedDB ?? null })
      .then(({ store, pointer }) => {
        if (!vivo) return;
        storeRef.current = store;

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

      void store.write({ id, name, project }).then((outcome) => {
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
    // would be written under the **previous** project's key — the same silent
    // overwrite, one effect later.
  }, [state.project, state.projectId, state.isDirty, restoring, toast]);

  // The autosave keeps failing after the first notice, so the flag is what keeps
  // one full project from producing a toast on every keystroke. It clears when the
  // project fits again, which is the only time the situation has changed.
  useEffect(() => {
    if (!state.isDirty) quotaAvisadaRef.current = false;
  }, [state.isDirty]);

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

  const navigate = (view: ComposerView) => {
    if (window.location.hash !== `#/${view}`) {
      window.location.hash = `/${view}`;
      return;
    }
    dispatch({ type: 'NAVIGATE', payload: view });
  };

  return (
    <ComposerContext.Provider value={{ state, dispatch, navigate }}>
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
