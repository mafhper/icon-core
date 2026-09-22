/**
 * Opens the Command Palette from anywhere (the Topbar button, a menu item…).
 *
 * The palette owns its open state, so callers signal through a document event
 * instead of lifting that state into every consumer.
 */
export const COMMAND_PALETTE_EVENT = 'iconcore:open-command-palette';

export const openCommandPalette = (): void => {
  document.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
};
