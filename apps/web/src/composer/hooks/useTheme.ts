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
/**
 * A theme flip changes colour, background, border and shadow on nearly every
 * element at once, so every transition on those properties would fire together
 * and the switch would smear instead of snapping (better-ui). Disable transitions
 * for the swap, force a reflow so the new theme paints without them, then restore
 * on the next frame.
 */
const suppressTransitionsDuringSwap = (): void => {
  const style = document.createElement('style');
  style.appendChild(document.createTextNode('*,*::before,*::after{transition:none !important}'));
  document.head.appendChild(style);
  // Reading layout flushes the style above before the theme attribute changes.
  void document.body.offsetHeight;
  requestAnimationFrame(() => style.remove());
};

export const useTheme = (): void => {
  useEffect(() => {
    suppressTransitionsDuringSwap();
    document.documentElement.setAttribute('data-theme', resolveTheme());
  }, []);
};