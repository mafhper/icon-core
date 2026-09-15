import { useEffect } from 'react';

/**
 * Theme phase 0 (PR-02): the editor is dark-only.
 *
 * Applies `data-theme="dark"` on `<html>`, porting the theme mechanism from the
 * legacy `app/App.tsx` into the Composer shell. The light token block is
 * already prepared in `index.css` but is not reachable yet.
 *
 * TODO(Fase 1/7): expose the theme preference selector and resolve `auto` via
 * `matchMedia('(prefers-color-scheme: dark)')`, reading `iconcore-theme-preference`
 * from localStorage (the legacy implementation lives in `apps/web/src/app/App.tsx`).
 */
export const useTheme = (): void => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);
};