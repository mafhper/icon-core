/**
 * Modifier-key label for shortcut hints. The handlers accept both `metaKey` and
 * `ctrlKey`; the label must match the platform the user is on (⌘ on macOS, Ctrl
 * elsewhere) instead of always showing the Mac symbol.
 */
export const modKey = (): string =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';
