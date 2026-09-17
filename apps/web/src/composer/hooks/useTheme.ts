import { useEffect } from 'react';

export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'iconcore-theme-preference';

/**
 * Resolve the theme from an explicit preference, falling back to the OS
 * preference and finally to dark (the editor's default).
 *
 * Priority: `?theme=` query param > `localStorage[iconcore-theme-preference]`
 * > `matchMedia('(prefers-color-scheme: light)')` > dark.
 */
const resolveTheme = (): ResolvedTheme => {
  const fromQuery = new URLSearchParams(window.location.search).get('theme');
  if (fromQuery === 'light' || fromQuery === 'dark') return fromQuery;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
};

/**
 * Theme phase 1 (A1): the Composer shell resolves `data-theme` from the user's
 * preference instead of always forcing dark. The light surface is now
 * reachable through `?theme=light`, the localStorage key, or the OS setting.
 *
 * TODO(Fase 1/7): expose the theme preference selector in settings (writes
 * `iconcore-theme-preference`); `auto` still resolves via matchMedia.
 */
export const useTheme = (): void => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolveTheme());
  }, []);
};