import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import { createProjectFromAsset } from './utils/projectFactory';

const asset = {
  name: 'Open Source Mark',
  mimeType: 'image/png',
  data: 'AA==',
  width: 256,
  height: 128
};

describe('Icon Core workspaces state', () => {
  it('creates a v2 project from an uploaded asset', () => {
    const project = createProjectFromAsset(asset);
    expect(project.schemaVersion).toBe(2);
    expect(project.layers).toHaveLength(1);
    expect(project.layers[0].source.type).toBe('inline');
    expect(project.targets.some((target) => target.target === 'web-favicon' && target.enabled)).toBe(true);
  });

  it('keeps transient layer updates out of history until commit', () => {
    const loaded = composerReducer(initialState, {
      type: 'LOAD_PROJECT',
      payload: { project: createProjectFromAsset(asset), view: 'edit-space' }
    });
    const id = loaded.project!.layers[0].id;

    const transient = composerReducer(loaded, {
      type: 'UPDATE_LAYER',
      payload: { id, transient: true, changes: { transform: { x: 10, y: 0, scale: 1, rotation: 0 } } }
    });

    expect(transient.history).toHaveLength(1);
    expect(transient.project!.layers[0].transform.x).toBe(10);

    const committed = composerReducer(transient, { type: 'COMMIT_HISTORY' });
    expect(committed.history).toHaveLength(2);
  });

  it('stores variant-only overrides on the selected layer', () => {
    const loaded = composerReducer(initialState, {
      type: 'LOAD_PROJECT',
      payload: { project: createProjectFromAsset(asset), view: 'edit-space' }
    });
    const id = loaded.project!.layers[0].id;

    const updated = composerReducer(loaded, {
      type: 'UPDATE_LAYER_VARIANT',
      payload: {
        id,
        variant: 'dark',
        changes: { transform: { x: 12, y: 8, scale: 0.8, rotation: 0 }, opacity: 0.72 }
      }
    });

    expect(updated.project!.layers[0].variantOverrides?.dark?.transform?.x).toBe(12);
    expect(updated.project!.layers[0].variantOverrides?.dark?.opacity).toBe(0.72);
  });

  it('generates and clears variant presets across layers', () => {
    const created = composerReducer(initialState, { type: 'NEW_PROJECT', payload: { name: 'T', size: 512 } });
    const withLayer = composerReducer(created, {
      type: 'ADD_LAYER',
      payload: { shape: { kind: 'circle', width: 100, height: 100 } }
    });

    const generated = composerReducer(withLayer, { type: 'GENERATE_VARIANT', payload: { variant: 'dark' } });
    expect(generated.project!.layers[0].variantOverrides?.dark?.fill).toBeDefined();
    expect(generated.project!.variants.dark?.canvas?.background?.color).toBe('#0f172a');

    const cleared = composerReducer(generated, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });
    expect(cleared.project!.layers[0].variantOverrides?.dark).toBeUndefined();
  });
});
