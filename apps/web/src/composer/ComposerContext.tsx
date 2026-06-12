import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { IconCoreProject } from '@iconcore/shared';
import { composerReducer, initialState, type ComposerState, type ComposerAction } from './composerReducer';

interface ComposerContextValue {
  state: ComposerState;
  dispatch: React.Dispatch<ComposerAction>;
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
          view: 'compose' as const,
          history: [project],
          historyIndex: 0
        };
      } catch (err) {
        console.warn('Failed to restore saved IconCore Composer project:', err);
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
      const hash = window.location.hash;
      if (hash.startsWith('#/composer')) {
        const view = hash.replace('#/composer/', '') as ComposerState['view'];
        if (['start', 'compose', 'variants', 'preview', 'export', 'audit'].includes(view)) {
          dispatch({ type: 'NAVIGATE', payload: view });
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <ComposerContext.Provider value={{ state, dispatch }}>
      {children}
    </ComposerContext.Provider>
  );
};

export const useComposer = (): ComposerContextValue => {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within ComposerProvider');
  return ctx;
};
