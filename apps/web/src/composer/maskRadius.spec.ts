import { describe, expect, it } from 'vitest';
import { defaultMaskRadius, type IconCoreProject } from '@iconcore/shared';
import { composerReducer, initialState } from './composerReducer';
import { createProjectFromAsset } from './utils/projectFactory';

/**
 * The canvas frame radius was a literal chain in `PreviewCanvas`:
 *
 *   circle ? '50%' : rounded-rectangle ? '24px' : '4px'
 *
 * Four shapes are declared and three were handled, so `squircle` silently got
 * the square's 4px while `KeylineOverlay` drew its guide at the iOS superellipse
 * value (22.37%). Two constants for one idea, one of them wrong.
 *
 * Now `canvas.maskRadius` is additive and optional — absent means the shape's
 * own default — and `defaultMaskRadius` is the single place the rule lives.
 */

const SIZE = 512;

const project = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'T', shortName: 'T' },
  canvas: { size: SIZE, background: { kind: 'solid', color: '#ffffff' } },
  layers: [],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 't', quality: 0.95, generateReport: false },
  ...overrides
});

const withProject = (p: IconCoreProject = project()) =>
  composerReducer(initialState, { type: 'LOAD_PROJECT', payload: { project: p, view: 'edit-space' } });

describe('defaultMaskRadius', () => {
  it('gives each shape its own default, and squircle is no longer the square value', () => {
    expect(defaultMaskRadius('square', SIZE)).toBe(4);
    expect(defaultMaskRadius('rounded-rectangle', SIZE)).toBe(24);
    expect(defaultMaskRadius('circle', SIZE)).toBe(SIZE / 2);
    // The value `KeylineOverlay` uses for the superellipse guide.
    expect(defaultMaskRadius('squircle', SIZE)).toBeCloseTo(114.5, 1);
    expect(defaultMaskRadius('squircle', SIZE)).not.toBe(defaultMaskRadius('square', SIZE));
  });

  it('scales with the canvas side', () => {
    expect(defaultMaskRadius('circle', 1024)).toBe(512);
    expect(defaultMaskRadius('squircle', 1024)).toBeCloseTo(229.1, 1);
    // The two pixel-valued defaults are literal, so they do not scale.
    expect(defaultMaskRadius('rounded-rectangle', 1024)).toBe(24);
  });
});

describe('canvas.maskRadius', () => {
  it('is absent on a project that never set it, so nothing changes', () => {
    const p = createProjectFromAsset({ name: 'X', mimeType: 'image/png', data: 'AA==', width: 256, height: 256 });
    expect(p.canvas.maskRadius).toBeUndefined();
  });

  it('sets a value and persists it', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: 64 } });
    expect(state.project!.canvas.maskRadius).toBe(64);
  });

  it('clamps to half the side, where the corners would cross over', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: 9999 } });
    expect(state.project!.canvas.maskRadius).toBe(SIZE / 2);

    state = composerReducer(state, { type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: -50 } });
    expect(state.project!.canvas.maskRadius).toBe(0);
  });

  it('clearing restores the shape default instead of pinning zero', () => {
    let state = withProject();
    state = composerReducer(state, { type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: 64 } });
    state = composerReducer(state, { type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: null } });
    expect(state.project!.canvas.maskRadius).toBeUndefined();
  });

  it('does not push history on a transient change, but does on commit', () => {
    let state = withProject();
    const before = state.history.length;

    state = composerReducer(state, {
      type: 'SET_CANVAS_MASK_RADIUS',
      payload: { radius: 40, transient: true }
    });
    // The value is live (so the frame follows the drag) but undo has nothing to
    // step back to yet — the same contract the import-margin slider uses.
    expect(state.project!.canvas.maskRadius).toBe(40);
    expect(state.history).toHaveLength(before);

    state = composerReducer(state, { type: 'COMMIT_HISTORY' });
    expect(state.history).toHaveLength(before + 1);
  });
});
