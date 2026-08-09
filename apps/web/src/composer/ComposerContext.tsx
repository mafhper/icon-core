import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { IconCoreProject } from '@iconcore/shared';
import {
  composerReducer,
  initialState,
  normalizeRoute,
  type ComposerState,
  type ComposerAction,
  type ComposerView
} from './composerReducer';
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
    const project = JSON.parse(saved) as IconCoreProject;
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
        dispatch({ type: 'SET_DIRTY', payload: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
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
