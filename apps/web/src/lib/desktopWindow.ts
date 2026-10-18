/**
 * The desktop shell's window handle (Tauri only).
 *
 * The bar's window controls are the ones a decorated OS window would draw:
 * minimize, maximize/restore and close. They exist only under the Tauri
 * runtime — the web has no window to drive — so the handle is resolved lazily
 * and a missing runtime is a no-op instead of an error: the same titlebar
 * renders on both targets and CSS hides the zone on the web.
 *
 * `__TAURI__.window` is the global API (`app.withGlobalTauri` in
 * `src-tauri/tauri.conf.json`), the same surface `desktopExport.ts` already
 * uses through `__TAURI__.core`. The global is absent in the browser, so the
 * guard is the runtime check itself.
 */

export interface DesktopWindowHandle {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  /** Subscribe to window resizes; resolves to the unsubscribe function. */
  onResized: (handler: () => void) => Promise<() => void>;
}

interface TauriWindowModule {
  getCurrentWindow?: () => DesktopWindowHandle;
}

interface TauriGlobal {
  __TAURI__?: {
    window?: TauriWindowModule;
  };
}

export const getDesktopWindow = (): DesktopWindowHandle | null => {
  const runtime = window as Window & TauriGlobal;
  const api = runtime.__TAURI__?.window;
  if (!api || typeof api.getCurrentWindow !== 'function') return null;
  try {
    return api.getCurrentWindow();
  } catch {
    // The runtime exists but cannot resolve a window (no window context).
    return null;
  }
};
