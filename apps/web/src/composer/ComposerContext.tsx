import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import {
  composerReducer,
  initialState,
  normalizeRoute,
  type ComposerState,
  type ComposerAction,
  type ComposerView
} from './composerReducer';
import { parseProjectFile } from './utils/projectGuard';
import { saveProject, describeSaveOutcome } from './utils/projectStorage';
import { useToast } from './toast/ToastContext';

const STORAGE_KEY = 'iconcore-composer-project';

interface ComposerContextValue {
  state: ComposerState;
  dispatch: React.Dispatch<ComposerAction>;
  navigate: (view: ComposerView) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

const restoreInitialState = (): { init: ComposerState; failed: boolean } => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { init: initialState, failed: false };
  try {
    // Accepts v2 (legacy) and v3, migrating to the canonical v3 document.
    const project = parseProjectFile(saved);
    if (!project) throw new Error('unrecognized project payload');
    return {
      init: {
        ...initialState,
        project,
        view: 'edit-space',
        history: [project],
        historyIndex: 0,
        enabledTargets: new Set(project.targets.filter((target) => target.enabled).map((target) => target.target))
      },
      failed: false
    };
  } catch (err) {
    console.warn('Failed to restore saved Icon Core project:', err);
    localStorage.removeItem(STORAGE_KEY);
    return { init: initialState, failed: true };
  }
};

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const toast = useToast();
  const restoredRef = useRef<{ init: ComposerState; failed: boolean } | null>(null);
  const quotaAvisadaRef = useRef(false);
  if (restoredRef.current === null) restoredRef.current = restoreInitialState();
  const [state, dispatch] = useReducer(composerReducer, restoredRef.current.init);

  useEffect(() => {
    if (restoredRef.current?.failed) {
      toast.error('Could not restore your saved project. Starting with a clean workspace.');
    }
  }, [toast]);

  useEffect(() => {
    if (state.project && state.isDirty) {
      const timer = setTimeout(() => {
        const outcome = saveProject(localStorage, STORAGE_KEY, state.project);
        // Only a quota failure clears the dirty flag. Telling the editor the work
        // is saved when it is not would be the same silent failure one layer
        // down.
        if (outcome.kind === 'saved') {
          dispatch({ type: 'SET_DIRTY', payload: false });
          return;
        }

        const aviso = describeSaveOutcome(outcome);
        if (aviso && !quotaAvisadaRef.current) {
          quotaAvisadaRef.current = true;
          toast.error(aviso);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.project, state.isDirty, toast]);

  // The autosave keeps failing after the first notice, so the flag is what keeps
  // one full project from producing a toast on every keystroke. It clears when
  // the project fits again, which is the only time the situation has changed.
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
