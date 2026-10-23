/**
 * Single source for the studio titlebar's menu text (P2).
 *
 * Every Portuguese string the titlebar menus paint lives here and nowhere
 * else: the bar imports the object, the specs pin the same object, and a
 * label that changes once changes in both. The closed map is the plan's —
 * Arquivo (Novo, Abrir, Recentes, Renomear, Fechar + Salvar, Salvar como,
 * Exportar), Editar (Desfazer, Refazer, Duplicar), Exibir (grade, zoom,
 * variantes + Tema rádio) and Sobre (Atalhos, Preferências, Sobre) — with no
 * "Abrir pasta": there is no folder picker in the app, and a menu row is not
 * a place to announce one.
 *
 * ## What stays English, deliberately
 *
 * The lote translates **the menus**. Everything that is not a menu keeps the
 * app's single voice until a localization pass owns all of it:
 *
 * - dialogs (new/rename/close/confirm, Preferences, About and the export
 *   panel keep the app's English; the shortcuts dialog is the exception the
 *   map names — its title, groups and rows are Portuguese in this lote);
 * - toasts (`Opened …`, `Saved to …`, the failed-open warning) and the
 *   welcome;
 * - the canvas column's own menus (`View options`, the pill's zoom presets)
 *   and every canvas/sidebar chrome label;
 * - every `aria-label` of the existing regions — renaming them would move
 *   specs and real assistive text out from under the components that own
 *   them, for no user-visible gain.
 *
 * Two exceptions, both pinned elsewhere and on purpose:
 *
 * - **Variant names** (`Default`/`Light`/`Dark`/`Monochrome`) are identities
 *   shared by the tiles, the breadcrumb, the Inspector grid and the export
 *   flow — `variantLabels.ts` is their single source. Translating them only
 *   inside the Exibir menu would give one icon state two names on one
 *   screen, which is the defect this codebase treats as worse than mixed
 *   language.
 * - The `Tema` options are Portuguese here because the map fixes them
 *   ("Claro/Escuro/Sistema"); Preferences keeps its own English spelling of
 *   the same setting until the dialog is localized.
 */
export const studioMenuLabels = {
  menus: {
    file: 'Arquivo',
    edit: 'Editar',
    view: 'Exibir',
    about: 'Sobre'
  },
  file: {
    new: 'Novo',
    open: 'Abrir',
    recents: 'Recentes',
    recentsEmpty: 'Nenhum projeto recente',
    rename: 'Renomear',
    close: 'Fechar',
    save: 'Salvar',
    saveAs: 'Salvar como',
    export: 'Exportar'
  },
  edit: {
    undo: 'Desfazer',
    redo: 'Refazer',
    duplicate: 'Duplicar'
  },
  view: {
    gridOn: 'Grade — Ligada',
    gridOff: 'Grade — Desligada',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    zoomReset: 'Zoom 100%',
    variants: 'Variantes',
    theme: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    themeSystem: 'Sistema'
  },
  about: {
    shortcuts: 'Atalhos',
    preferences: 'Preferências',
    about: 'Sobre o Icon-Core'
  }
} as const;

/** The failed-open warning, shown as a toast when a recent is already gone. */
export const recentOpenFailedMessage = 'Could not open that project.';
