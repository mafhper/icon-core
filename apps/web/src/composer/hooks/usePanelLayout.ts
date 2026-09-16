import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

const LEFT_KEY = 'iconcore:panel-left';
const RIGHT_KEY = 'iconcore:panel-right';
const LEFT_MIN = 200;
const LEFT_MAX = 360;
const RIGHT_MIN = 240;
const RIGHT_MAX = 380;

const readStored = (key: string, fallback: number): number => {
  try {
    const raw = window.localStorage.getItem(key);
    // Number(null) === 0, which would collapse panels to 0px on first run;
    // a missing key must fall back to the default width.
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key: string, value: number): void => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // storage may be unavailable (private mode); persistence is best-effort
  }
};

/**
 * Panel layout state for the Composer AppShell (PR-06):
 *
 * - Breakpoints: small < 900 (drawer + bottom tool rail), medium 900–1179
 *   (inspector becomes a right-hand sheet), large >= 1180 (full columns).
 * - `leftOpen`/`inspectorOpen` only matter for overlay modes (small drawer,
 *   small+medium sheet); in large mode the panels are always visible columns.
 * - Panel widths are user-resizable and persisted to localStorage.
 */
export const usePanelLayout = () => {
  const isSmall = useMediaQuery('(max-width: 899px)');
  const isMedium = useMediaQuery('(min-width: 900px) and (max-width: 1179px)');
  const isLarge = useMediaQuery('(min-width: 1180px)');

  const [leftWidth, setLeftWidth] = useState<number>(() => readStored(LEFT_KEY, 240));
  const [rightWidth, setRightWidth] = useState<number>(() => readStored(RIGHT_KEY, 288));
  const [leftOpen, setLeftOpen] = useState<boolean>(() => !window.matchMedia('(max-width: 899px)').matches);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() => window.matchMedia('(min-width: 1180px)').matches);

  const toggleLeft = useCallback(() => setLeftOpen((open) => !open), []);
  const toggleInspector = useCallback(() => setInspectorOpen((open) => !open), []);

  const closePanels = useCallback(() => {
    setLeftOpen(false);
    setInspectorOpen(false);
  }, []);

  // Escape closes any open overlay (drawer/sheet). No-op when panels are columns.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanels();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanels]);

  // Drawer/sheet should never remain open after resizing into large layout, and
  // overlays collapse when leaving large (columns) for medium/small viewports.
  const wasLargeRef = useRef(isLarge);
  useEffect(() => {
    const previousLarge = wasLargeRef.current;
    wasLargeRef.current = isLarge;
    if (!isLarge && previousLarge) {
      setLeftOpen(false);
      setInspectorOpen(false);
      return;
    }
    if (isSmall) {
      setInspectorOpen(false);
    }
  }, [isLarge, isSmall]);

  const startResize = useCallback(
    (side: 'left' | 'right') =>
      (event: React.PointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = side === 'left' ? leftWidth : rightWidth;
        const setWidth = side === 'left' ? setLeftWidth : setRightWidth;
        const key = side === 'left' ? LEFT_KEY : RIGHT_KEY;
        const min = side === 'left' ? LEFT_MIN : RIGHT_MIN;
        const max = side === 'left' ? LEFT_MAX : RIGHT_MAX;
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const onMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startX;
          const next = side === 'left' ? startWidth + delta : startWidth - delta;
          const clamped = Math.min(max, Math.max(min, Math.round(next)));
          setWidth(clamped);
          writeStored(key, clamped);
        };
        const onUp = (upEvent: PointerEvent) => {
          target.releasePointerCapture(upEvent.pointerId);
          target.removeEventListener('pointermove', onMove);
          target.removeEventListener('pointerup', onUp);
        };
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerup', onUp);
      },
    [leftWidth, rightWidth]
  );

  const overlayBackdropVisible =
    (isSmall && leftOpen) || ((isSmall || isMedium) && inspectorOpen);

  return {
    isSmall,
    isMedium,
    isLarge,
    leftWidth,
    rightWidth,
    leftOpen,
    inspectorOpen,
    toggleLeft,
    toggleInspector,
    closePanels,
    startLeftResize: startResize('left'),
    startRightResize: startResize('right'),
    overlayBackdropVisible
  };
};