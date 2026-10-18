import { describe, expect, it } from 'vitest';
import {
  EMPTY_BAR_OVERFLOW,
  STUDIO_BAR_PRIORITY,
  reduceBarOverflow,
  type StudioBarActionId,
  type StudioBarOverflowState
} from './barOverflow';

/**
 * The titlebar has no breakpoint: it folds actions by measuring itself. The
 * decision is pure, so the whole walk is asserted here instead of through a
 * mocked layout — the component only feeds it `scrollWidth > clientWidth`.
 *
 * The expected orders below are literals from the Lote 42 decision
 * (Save → Export → New → Shortcuts → Theme → Rename → Close → Preferences →
 * About), not a re-run of `STUDIO_BAR_PRIORITY`: if the list changes, these
 * tests must be re-read against the decision rather than agree with the code.
 */

/** Walks the reducer while the bar overflows, collecting each fold. */
const foldEverything = (state: StudioBarOverflowState = EMPTY_BAR_OVERFLOW) => {
  const folded: StudioBarActionId[] = [];
  let current = state;
  for (let guard = 0; guard < STUDIO_BAR_PRIORITY.length + 2; guard += 1) {
    const next = reduceBarOverflow(current, { overflowing: true, width: 600 });
    if (next === current) break;
    const added = next.collapsed.find((id) => !current.collapsed.includes(id));
    if (added) folded.push(added);
    current = next;
  }
  return { folded, state: current };
};

/** Walks the reducer while there is room, collecting each restore. */
const unfoldEverything = (state: StudioBarOverflowState) => {
  const restored: StudioBarActionId[] = [];
  let current = state;
  for (let guard = 0; guard < STUDIO_BAR_PRIORITY.length + 2; guard += 1) {
    const next = reduceBarOverflow(current, { overflowing: false, width: 1600 });
    if (next === current) break;
    if (next.pending && next.pending !== current.pending) restored.push(next.pending);
    current = next;
  }
  return { restored, state: current };
};

const allCollapsed: StudioBarOverflowState = {
  ...EMPTY_BAR_OVERFLOW,
  collapsed: [...STUDIO_BAR_PRIORITY]
};

describe('titlebar overflow (measured fold)', () => {
  it('folds from the tail of the priority, one action per measurement', () => {
    const { folded } = foldEverything();

    expect(folded).toEqual([
      'about',
      'preferences',
      'close',
      'rename',
      'theme',
      'shortcuts',
      'new',
      'export',
      'save'
    ]);
  });

  it('stops folding once every action is already in the menu', () => {
    const { state } = foldEverything();

    expect(state.collapsed).toHaveLength(9);
    // Same object: the caller applies this to state, and an unchanged identity
    // is what ends the measure → render → measure loop.
    expect(reduceBarOverflow(state, { overflowing: true, width: 600 })).toBe(state);
  });

  it('restores from the head of the priority — the inverse of the fold', () => {
    const { restored, state } = unfoldEverything(allCollapsed);

    expect(restored).toEqual([
      'save',
      'export',
      'new',
      'shortcuts',
      'theme',
      'rename',
      'close',
      'preferences',
      'about'
    ]);
    expect(state.collapsed).toHaveLength(0);
    expect(state.pending).toBeNull();
  });

  it('folds a restore back when it does not fit, and does not retry at that width', () => {
    // Room for one more action: the head of the priority comes back.
    const restored = reduceBarOverflow(allCollapsed, { overflowing: false, width: 700 });
    expect(restored.pending).toBe('save');
    expect(restored.collapsed).not.toContain('save');

    // …and the next measurement says the bar now overflows.
    const rejected = reduceBarOverflow(restored, { overflowing: true, width: 700 });
    expect(rejected.pending).toBeNull();
    expect(rejected.rejected).toBe('save');
    expect(rejected.rejectedAtWidth).toBe(700);
    expect(rejected.collapsed).toHaveLength(9);

    // The same width keeps the rejection: no oscillation between fold/unfold.
    expect(reduceBarOverflow(rejected, { overflowing: false, width: 700 })).toBe(rejected);
  });

  it('retries the restore after the bar gets a new width', () => {
    const rejected: StudioBarOverflowState = {
      ...allCollapsed,
      rejected: 'save',
      rejectedAtWidth: 700
    };

    const wider = reduceBarOverflow(rejected, { overflowing: false, width: 720 });
    expect(wider.rejected).toBeNull();
    expect(wider.rejectedAtWidth).toBeNull();
    expect(wider.pending).toBe('save');
  });

  it('leaves an empty, roomy bar untouched', () => {
    expect(reduceBarOverflow(EMPTY_BAR_OVERFLOW, { overflowing: false, width: 1600 })).toBe(EMPTY_BAR_OVERFLOW);
  });
});
