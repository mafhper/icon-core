import type { ProjectPointer } from '../composer/utils/projectStore';

/** How many entries the Arquivo menu's Recentes group shows. */
export const RECENTS_LIMIT = 5;

/**
 * The projects the menu offers, newest first, capped.
 *
 * `store.list()` already sorts by `updatedAt` — but the menu's contract is
 * its own: "Recentes" means most recently touched first, and that has to hold
 * for whatever list the provider publishes (a refresh, a future store, a
 * spec seeding a pool). Sorting here, on a copy, keeps the display rule in
 * the one place that renders it instead of trusting an upstream order nobody
 * in this file can see.
 */
export const pickRecents = (
  projects: readonly ProjectPointer[],
  limit: number = RECENTS_LIMIT
): ProjectPointer[] => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
