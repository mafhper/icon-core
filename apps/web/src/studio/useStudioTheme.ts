import { useEffect } from 'react';

export type StudioThemePreference = 'dark' | 'light' | 'system';

export type StudioResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'iconcore-theme-preference';

const readStored = (): StudioThemePreference => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    // Storage may be unavailable (private mode); fall through to dark-first.
  }
  return 'dark';
};

const fromQuery = (): StudioResolvedTheme | null => {
  const value = new URLSearchParams(window.location.search).get('theme');
  return value === 'light' || value === 'dark' ? value : null;
};

const systemTheme = (): StudioResolvedTheme =>
  window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

/**
 * Studio theme (Fase 1: Light/Dark/System completos).
 *
 * The shell is dark-first: without a stored preference the OS decides only
 * between light and dark, and anything unreadable resolves to dark. A theme
 * flip repaints nearly every element at once, so transitions on colour
 * properties are suppressed for the swap (the same reason the Composer's
 * `useTheme` does it) — otherwise the switch smears instead of snapping.
 */
export const useStudioTheme = (preference: StudioThemePreference): void => {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved: StudioResolvedTheme =
        fromQuery() ?? (preference === 'system' ? systemTheme() : preference);
      const swap = document.createElement('style');
      swap.appendChild(
        document.createTextNode('*,*::before,*::after{transition:none !important}')
      );
      document.head.appendChild(swap);
      // Reading layout flushes the suppression above before the swap paints.
      void document.body.offsetHeight;
      root.setAttribute('data-theme', resolved);
      requestAnimationFrame(() => swap.remove());
    };

    apply();
    if (preference !== 'system' || fromQuery()) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);
};

export const readThemePreference = readStored;

export const writeThemePreference = (preference: StudioThemePreference): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Best-effort persistence; the in-memory preference still applies.
  }
};
