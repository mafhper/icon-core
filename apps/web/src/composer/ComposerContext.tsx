import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { IconCoreProject } from '@iconcore/shared';
import {
  composerReducer,
  initialState,
  normalizeRoute,
  type ComposerState,
  type ComposerAction,
  type ComposerView
} from './composerReducer';

interface ComposerContextValue {
  state: ComposerState;
  dispatch: React.Dispatch<ComposerAction>;
  navigate: (view: ComposerView) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(composerReducer, initialState, (init) => {
    const saved = localStorage.getItem('iconcore-composer-project');
    if (saved) {
      try {
        const project = JSON.parse(saved) as IconCoreProject;
        return {
          ...init,
          project,
          view: 'edit-space' as const,
          history: [project],
          historyIndex: 0,
          enabledTargets: new Set(project.targets.filter((target) => target.enabled).map((target) => target.target))
        };
      } catch (err) {
        console.warn('Failed to restore saved Icon Core project:', err);
      }
    }
    return init;
  });

  useEffect(() => {
    if (state.project && state.isDirty) {
      const timer = setTimeout(() => {
        localStorage.setItem('iconcore-composer-project', JSON.stringify(state.project));
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

export const useComposer = (): ComposerContextValue => {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within ComposerProvider');
  return ctx;
};
