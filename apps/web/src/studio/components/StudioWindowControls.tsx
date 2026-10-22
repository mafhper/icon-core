import { useEffect, useMemo, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { getDesktopWindow } from '../../lib/desktopWindow';

/**
 * Window controls (F4): minimize, maximize/restore and close, in the Windows
 * order, at the bar's right end.
 *
 * They belong to the desktop shell only. On the web the zone is
 * `display: none` (`.studio-window-controls` in `studio.css`): browsers draw
 * their own chrome outside the page, so painting a second set would be a lie.
 * The zone is always in the DOM and CSS decides — the same single gate the
 * shell uses to mark `<html data-tauri>`.
 *
 * The controls are never disabled: a window can always be minimized, maximized
 * or closed, whatever the document state is. The middle button is one control
 * that toggles — it names the state it takes you to (Maximize / Restore) and
 * follows the real window through `onResized`, because a double-click on the
 * drag region toggles the window too.
 */
export const StudioWindowControls = () => {
  const win = useMemo(() => getDesktopWindow(), []);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!win) return undefined;
    let alive = true;
    const sync = () => {
      void win
        .isMaximized()
        .then((value) => {
          if (alive) setMaximized(value);
        })
        .catch(() => undefined);
    };

    sync();
    let stop: (() => void) | undefined;
    void win
      .onResized(sync)
      .then((off) => {
        if (alive) stop = off;
        else off();
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      stop?.();
    };
  }, [win]);

  const toggleMaximize = () => {
    if (!win) return;
    void win
      .toggleMaximize()
      .then(() => win.isMaximized())
      .then(setMaximized)
      .catch(() => undefined);
  };

  return (
    <div className="studio-window-controls">
      <button
        type="button"
        className="studio-window-control"
        aria-label="Minimize"
        onClick={() => void win?.minimize()}
      >
        <Minus size={12} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="studio-window-control"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={toggleMaximize}
      >
        {maximized ? <Copy size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
      </button>
      <button
        type="button"
        className="studio-window-control studio-window-close"
        aria-label="Close window"
        onClick={() => void win?.close()}
      >
        <X size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
};
