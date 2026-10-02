import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import { createProjectFromAsset } from './utils/projectFactory';

/**
 * Deleting a layer reordered the others.
 *
 * The Background layer is a UI handle that never renders (`composeLayers`
 * filters `role === 'background'`), and `ADD_LAYER` deliberately gives it the
 * **lowest** zIndex while appending it to the **end** of the array — so array
 * order and zIndex order were never the same thing.
 *
 * `REMOVE_LAYER` filtered the raw array and renumbered zIndex by array
 * position, so the Background handle came out with the *highest* zIndex and
 * jumped above the artwork in the list. The canvas did not change, because the
 * Background never paints — which is exactly why the bug looked like it only
 * existed in the sidebar.
 *
 * Scenario from the report: import an SVG, add a transparent background, add
 * another SVG component, delete one of them.
 */

const asset = (name: string) => ({
  name,
  mimeType: 'image/png',
  data: 'AA==',
  width: 256,
  height: 256
});

const withProject = () =>
  composerReducer(initialState, {
    type: 'LOAD_PROJECT',
    payload: { project: createProjectFromAsset(asset('First')), view: 'edit-space' }
  });

/** zIndex by layer name — the sidebar's rendering order is `b.zIndex - a.zIndex`. */
const zByName = (layers: { name: string; zIndex: number; role?: string }[]) =>
  Object.fromEntries(
    [...layers].sort((a, b) => a.zIndex - b.zIndex).map((l) => [l.name, l.zIndex])
  );

const names = (layers: { name: string }[]) => layers.map((l) => l.name);

describe('layer order survives a deletion', () => {
  it('keeps the background below the artwork after deleting a layer', () => {
    // 1. import an SVG
    let state = withProject();
    const first = state.project!.layers.find((l) => l.role !== 'background')!;
    expect(first.name).toBe('First');

    // 2. add a transparent background
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    const bg = state.project!.layers.find((l) => l.role === 'background')!;
    // The handle starts at the bottom.
    const beforeDelete = zByName(state.project!.layers);
    expect(beforeDelete[bg.name]).toBeLessThan(beforeDelete[first.name]);

    // 3. add a second SVG component on top
    state = composerReducer(state, {
      type: 'ADD_LAYER',
      payload: { asset: asset('Second') }
    });
    expect(names(state.project!.layers)).toContain('Second');

    // 4. delete the top component
    const second = state.project!.layers.find((l) => l.name === 'Second')!;
    state = composerReducer(state, { type: 'REMOVE_LAYER', payload: { id: second.id } });

    const after = zByName(state.project!.layers);
    const bgAfter = state.project!.layers.find((l) => l.role === 'background')!;

    // The artwork survives, the top component is gone, and the Background —
    // which is a real layer, not something deletion should remove — is STILL
    // below the artwork. Order is compared by zIndex, the way the sidebar sorts.
    expect([...state.project!.layers].sort((a, b) => a.zIndex - b.zIndex).map((l) => l.name)).toEqual([
      'Background',
      'First'
    ]);
    expect(after[bgAfter.name]).toBeLessThan(after['First']);
  });

  it('never gives the background handle the topmost zIndex', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    for (const name of ['A', 'B', 'C']) {
      state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset(name) } });
    }

    // Delete from the top down, which is what a user does when tidying up.
    for (let i = 0; i < 4; i++) {
      const sorted = [...state.project!.layers].sort((a, b) => b.zIndex - a.zIndex);
      const victim = sorted[0];
      state = composerReducer(state, { type: 'REMOVE_LAYER', payload: { id: victim.id } });

      const remaining = state.project!.layers;
      if (remaining.length === 0) break;
      const bg = remaining.find((l) => l.role === 'background');
      if (!bg) continue;
      const content = remaining.filter((l) => l.role !== 'background');
      // With nothing else left, the Background is trivially not above anything;
      // once something remains, it must stay strictly below all of it.
      const top = content.length ? Math.max(...content.map((l) => l.zIndex)) : null;
      if (top !== null) expect(bg.zIndex).toBeLessThan(top);
      else expect(bg.zIndex).toBe(-1);
    }
  });

  it('keeps zIndex unique after a deletion', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('A') } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('B') } });

    const b = state.project!.layers.find((l) => l.name === 'B')!;
    state = composerReducer(state, { type: 'REMOVE_LAYER', payload: { id: b.id } });

    const zs = state.project!.layers.map((l) => l.zIndex);
    expect(new Set(zs).size).toBe(zs.length);
  });

  it('does not disturb the order when the deleted layer was in the middle', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('Middle') } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('Top') } });

    const orderBefore = [...state.project!.layers].sort((a, b) => a.zIndex - b.zIndex).map((l) => l.role ?? l.name);
    const middle = state.project!.layers.find((l) => l.name === 'Middle')!;
    state = composerReducer(state, { type: 'REMOVE_LAYER', payload: { id: middle.id } });

    const orderAfter = [...state.project!.layers].sort((a, b) => a.zIndex - b.zIndex).map((l) => l.role ?? l.name);
    expect(orderAfter).toEqual(orderBefore.filter((n) => n !== 'Middle'));
  });

  it('opening a project selects the topmost artwork, not the Background', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('Second') } });

    // Re-open the same project, which is what happens on load or workspace switch.
    const reopened = composerReducer(state, {
      type: 'LOAD_PROJECT',
      payload: { project: state.project!, view: 'edit-space' }
    });

    const active = reopened.project!.layers.find((l) => l.id === reopened.activeLayerId);
    expect(active?.name).toBe('Second');
  });

  it('moving a layer to the back does not lift it above the background', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { background: true } });
    state = composerReducer(state, { type: 'ADD_LAYER', payload: { asset: asset('Art') } });

    const art = state.project!.layers.find((l) => l.name === 'Art')!;
    state = composerReducer(state, { type: 'MOVE_LAYER', payload: { id: art.id, direction: 'back' } });

    const remaining = state.project!.layers;
    const bg = remaining.find((l) => l.role === 'background')!;
    const artAfter = remaining.find((l) => l.id === art.id)!;
    expect(artAfter.zIndex).toBeGreaterThan(bg.zIndex);
  });
});
