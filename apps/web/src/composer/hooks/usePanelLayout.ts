import { useCallback, useState } from 'react';
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
 * Panel layout state for the Composer AppShell (PR-08 v2):
 *
 * Always-visible side panels model: Layers and Inspector are permanent
 * flex columns at every viewport width. `leftOpen`/`inspectorOpen` collapse
 * a panel to zero width (the shell maps them to `--panel-left`/`--panel-right`
 * as `0px`), and the canvas reflows into the freed space — content never moves
 * around or gets covered.
 * Panel widths are user-resizable on large viewports and persisted to
 * localStorage.
 */
export const usePanelLayout = () => {
  const isSmall = useMediaQuery('(max-width: 899px)');
  const isMedium = useMediaQuery('(min-width: 900px) and (max-width: 1179px)');
  const isLarge = useMediaQuery('(min-width: 1180px)');

  const [leftWidth, setLeftWidth] = useState<number>(() => readStored(LEFT_KEY, 240));
  const [rightWidth, setRightWidth] = useState<number>(() => readStored(RIGHT_KEY, 288));
  const [leftOpen, setLeftOpen] = useState<boolean>(true);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);

  const toggleLeft = useCallback(() => setLeftOpen((open) => !open), []);
  const toggleInspector = useCallback(() => setInspectorOpen((open) => !open), []);

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
    startLeftResize: startResize('left'),
    startRightResize: startResize('right')
  };
};