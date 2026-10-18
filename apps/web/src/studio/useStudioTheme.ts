import { useCallback, useEffect, useState } from 'react';

export type StudioThemePreference = 'dark' | 'light' | 'system';

export type StudioResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'iconcore-theme-preference';

const readStored = (): StudioThemePreference => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    // Storage may be unavailable (private mode); fall through to system.
  }
  return 'system';
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
 * The shell follows the OS by default (`system`): without a stored preference
 * the OS decides between light and dark, and anything unreadable resolves to
 * dark. A theme flip repaints nearly every element at once, so transitions on
 * colour properties are suppressed for the swap (the same reason the Composer's
 * `useTheme` does it) — otherwise the switch smears instead of snapping.
 *
 * Returns the **resolved** theme — the value `[data-theme]` carries: `system`
 * resolves through the OS, so the attribute always holds a concrete light or
 * dark. The titlebar's theme control is the Exibir menu's ternary radio and
 * reads the preference, not this value; the resolved half exists for the
 * attribute the whole shell themes off.
 */
export const useStudioTheme = (preference: StudioThemePreference): StudioResolvedTheme => {
  const resolve = useCallback(
    (): StudioResolvedTheme => fromQuery() ?? (preference === 'system' ? systemTheme() : preference),
    [preference]
  );
  const [resolved, setResolved] = useState<StudioResolvedTheme>(resolve);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const next = resolve();
      const swap = document.createElement('style');
      swap.appendChild(
        document.createTextNode('*,*::before,*::after{transition:none !important}')
      );
      document.head.appendChild(swap);
      // Reading layout flushes the suppression above before the swap paints.
      void document.body.offsetHeight;
      root.setAttribute('data-theme', next);
      setResolved(next);
      requestAnimationFrame(() => swap.remove());
    };

    apply();
    if (preference !== 'system' || fromQuery()) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference, resolve]);

  return resolved;
};

export const readThemePreference = readStored;

export const writeThemePreference = (preference: StudioThemePreference): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Best-effort persistence; the in-memory preference still applies.
  }
};
