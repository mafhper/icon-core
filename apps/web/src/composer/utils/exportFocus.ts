/**
 * Surfaces the Inspector Export tab from anywhere: the main menu, `Ctrl+E`, the
 * command palette, the welcome's "Upload → Export" and the legacy deep-links.
 *
 * Export is a **tab inside the Inspector**, not a view: the `export-utilities`
 * route and its dialog left with the P2 cut, and the tab state lives in the
 * studio shell. Callers therefore signal through a document event — the same
 * shape `commandPalette.ts` uses for its own open state — so no consumer has to
 * lift the tab into every entry point, and there is no second surface to drift.
 */
export const EXPORT_FOCUS_EVENT = 'iconcore:focus-export-tab';

/** Ask the studio to reveal its Inspector on the Export tab. No-op with no listener. */
export const requestExportFocus = (): void => {
  document.dispatchEvent(new CustomEvent(EXPORT_FOCUS_EVENT));
};
