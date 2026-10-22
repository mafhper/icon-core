import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
  type RefObject,
} from 'react';

import { APPEARANCES, DEFAULT_RADIUS, resolveDarkTheme, type Appearance } from '../../lib/appearance';

type Pointer = { x: number; y: number; active: boolean };

type StudioState = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  radius: number;
  setRadius: (radius: number) => void;
  /** Effective page theme after resolving "default" against the system preference. */
  dark: boolean;
  reducedMotion: boolean;
  pointer: RefObject<Pointer>;
};

// Keep one context identity across hot reloads: when this module re-evaluates, a fresh
// createContext() would split the mounted provider (old object) from the consumers
// (new object) and the page would go blank with "useStudio must be used inside
// StudioProvider".
const globalKey = '__iconCoreStudioContext' as const;
type GlobalWithContext = typeof globalThis & { [globalKey]?: Context<StudioState | null> };
const g = globalThis as GlobalWithContext;
const StudioContext = (g[globalKey] ??= createContext<StudioState | null>(null));
const STORAGE_KEY = 'icon-core:appearance';

function isAppearance(value: string | null): value is Appearance {
  return value !== null && APPEARANCES.some((item) => item.id === value);
}

function readStoredAppearance(): Appearance | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAppearance(stored) ? stored : null;
  } catch {
    // Storage can be blocked (private mode, sandboxed frame). The page still works.
    return null;
  }
}

function storeAppearance(appearance: Appearance) {
  try {
    window.localStorage.setItem(STORAGE_KEY, appearance);
  } catch {
    // Persistence is a convenience, never a requirement.
  }
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>('default');
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [systemDark, setSystemDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointer = useRef<Pointer>({ x: 0, y: 0, active: false });

  useEffect(() => {
    const stored = readStoredAppearance();
    if (stored) setAppearanceState(stored);

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setSystemDark(darkQuery.matches);
      setReducedMotion(motionQuery.matches);
    };
    sync();
    darkQuery.addEventListener('change', sync);
    motionQuery.addEventListener('change', sync);

    pointer.current = { x: window.innerWidth / 2, y: window.innerHeight * 0.4, active: false };
    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, active: true };
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      darkQuery.removeEventListener('change', sync);
      motionQuery.removeEventListener('change', sync);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  const dark = resolveDarkTheme(appearance, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('mono', appearance === 'mono');
  }, [dark, appearance]);

  const value = useMemo<StudioState>(
    () => ({
      appearance,
      setAppearance: (next) => {
        setAppearanceState(next);
        storeAppearance(next);
      },
      radius,
      setRadius,
      dark,
      reducedMotion,
      pointer,
    }),
    [appearance, radius, dark, reducedMotion]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- The hook belongs to this provider; splitting it would duplicate the context object.
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used inside StudioProvider');
  return context;
}
