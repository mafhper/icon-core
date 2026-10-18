/**
 * Distributed titlebar: which actions leave the bar for the overflow menu.
 *
 * The bar is measured, not breakpointed. `ResizeObserver` reports a width, the
 * bar reports `scrollWidth > clientWidth`, and this module decides **one**
 * action per measurement: fold the lowest-priority action that still fits, or
 * bring back the highest-priority folded one. Deciding one at a time is what
 * makes the result the widest set that fits instead of a guess about which
 * widths matter — there is no `@media` breakpoint anywhere in the titlebar.
 *
 * `PRIORITY` is the keep-order: the head stays when width runs out, the tail
 * leaves first. Collapse walks it backwards, restore walks it forwards (the
 * inverse of the collapse), so the same width always settles on the same set.
 *
 * Restoring is where a naive implementation oscillates: bringing an action back
 * can overflow the bar again, folding it back frees the width, and the loop
 * never ends. So a restore is provisional — `pending` — and the next
 * measurement either accepts it or folds it back and records
 * `rejectedAtWidth`. That record is cleared by the next width change, which is
 * the only event that can make the rejected action fit.
 */

export type StudioBarActionId =
  | 'save'
  | 'export'
  | 'new'
  | 'shortcuts'
  | 'theme'
  | 'rename'
  | 'close'
  | 'preferences'
  | 'about';

/**
 * Keep-order, highest priority first.
 *
 * `preferences` and `about` sit in the tail on purpose: they are the first
 * actions to leave the bar, which is why a wide bar shows them and a narrow one
 * only reaches them through the overflow menu — the same action set, measured.
 */
export const STUDIO_BAR_PRIORITY: readonly StudioBarActionId[] = [
  'save',
  'export',
  'new',
  'shortcuts',
  'theme',
  'rename',
  'close',
  'preferences',
  'about'
];

export interface StudioBarOverflowState {
  /** Actions currently folded into the overflow menu. */
  collapsed: readonly StudioBarActionId[];
  /** Brought back in the last step; the next measurement accepts or undoes it. */
  pending: StudioBarActionId | null;
  /** Action whose restore overflowed at `rejectedAtWidth`. */
  rejected: StudioBarActionId | null;
  /** Bar width at which `rejected` failed; a different width retries. */
  rejectedAtWidth: number | null;
}

export const EMPTY_BAR_OVERFLOW: StudioBarOverflowState = {
  collapsed: [],
  pending: null,
  rejected: null,
  rejectedAtWidth: null
};

export interface StudioBarMeasurement {
  /** `bar.scrollWidth > bar.clientWidth` as measured. */
  overflowing: boolean;
  /** `bar.clientWidth` in the same measurement. */
  width: number;
}

/**
 * One step of the fold/unfold walk.
 *
 * Returns the **same object** when there is nothing to do — the caller applies
 * the result to state, and an unchanged identity is what stops the effect loop
 * (an action that does not fit at the extreme leaves the widest set collapsed
 * and no further step exists).
 */
export const reduceBarOverflow = (
  state: StudioBarOverflowState,
  { overflowing, width }: StudioBarMeasurement
): StudioBarOverflowState => {
  // A width change is the only thing that can make a rejected restore fit.
  const settled =
    state.rejectedAtWidth !== null && state.rejectedAtWidth !== width
      ? { ...state, rejected: null, rejectedAtWidth: null }
      : state;

  if (overflowing) {
    if (settled.pending) {
      // The restore just accepted does not fit: fold it back, remember where.
      return {
        ...settled,
        collapsed: [...settled.collapsed, settled.pending],
        pending: null,
        rejected: settled.pending,
        rejectedAtWidth: width
      };
    }
    const next = [...STUDIO_BAR_PRIORITY].reverse().find((id) => !settled.collapsed.includes(id));
    if (!next) return settled;
    return { ...settled, collapsed: [...settled.collapsed, next] };
  }

  const accepted = settled.pending ? { ...settled, pending: null } : settled;
  if (accepted.collapsed.length === 0) {
    if (accepted.rejected === null && accepted.rejectedAtWidth === null) return accepted;
    return { ...accepted, rejected: null, rejectedAtWidth: null };
  }
  // Blocked at this width: a restore already failed here, so stop asking.
  if (accepted.rejected !== null) return accepted;

  const back = STUDIO_BAR_PRIORITY.find((id) => accepted.collapsed.includes(id));
  if (!back) return accepted;
  return { ...accepted, collapsed: accepted.collapsed.filter((id) => id !== back), pending: back };
};
