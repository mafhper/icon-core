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
  it('creates a v3 project from an uploaded asset', () => {
    const project = createProjectFromAsset(asset);
    expect(project.schemaVersion).toBe(3);
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
    const darkBg = generated.project!.variants.dark?.canvas?.background;
    expect(darkBg?.kind === 'solid' ? darkBg.color : undefined).toBe('#0f172a');

    const cleared = composerReducer(generated, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });
    expect(cleared.project!.layers[0].variantOverrides?.dark).toBeUndefined();
  });
});

describe('background layer handle', () => {
  const withProject = (project: ReturnType<typeof createProjectFromAsset>) =>
    composerReducer(initialState, { type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });

  it('creates a non-rendering handle below the other layers without shifting them', () => {
    const loaded = withProject(createProjectFromAsset(asset));
    const before = loaded.project!.layers.map((layer) => layer.zIndex);

    const added = composerReducer(loaded, { type: 'ADD_LAYER', payload: { background: true } });
    const handle = added.project!.layers.find((layer) => layer.role === 'background');

    expect(handle).toBeDefined();
    expect(handle!.zIndex).toBeLessThan(Math.min(...before));
    expect(added.project!.layers.filter((layer) => layer.role !== 'background').map((layer) => layer.zIndex)).toEqual(before);
    expect(added.activeLayerId).toBe(handle!.id);
  });

  it('re-selects the existing handle instead of duplicating it', () => {
    const loaded = withProject(createProjectFromAsset(asset));
    const once = composerReducer(loaded, { type: 'ADD_LAYER', payload: { background: true } });
    const twice = composerReducer(once, { type: 'ADD_LAYER', payload: { background: true } });

    expect(twice.project!.layers.filter((layer) => layer.role === 'background')).toHaveLength(1);
    expect(twice.project!.layers).toHaveLength(once.project!.layers.length);
  });

  it('accepts a transparent canvas background', () => {
    const loaded = withProject(createProjectFromAsset(asset));
    const next = composerReducer(loaded, {
      type: 'SET_CANVAS_BACKGROUND',
      payload: { background: { kind: 'none' } }
    });
    expect(next.project!.canvas.background).toEqual({ kind: 'none' });
  });
});

describe('Work area backdrop (SET_EDITOR_BACKDROP)', () => {
  it('defaults to dots', () => {
    expect(initialState.editorBackdrop).toBe('dots');
  });

  it('accepts each of the three backdrops', () => {
    for (const backdrop of ['grid', 'plain', 'dots'] as const) {
      const next = composerReducer(initialState, { type: 'SET_EDITOR_BACKDROP', payload: backdrop });
      expect(next.editorBackdrop).toBe(backdrop);
    }
  });

  it('touches nothing else in the state', () => {
    const next = composerReducer(initialState, { type: 'SET_EDITOR_BACKDROP', payload: 'grid' });
    expect(next.project).toBe(initialState.project);
    expect(next.activeLayerId).toBe(initialState.activeLayerId);
    expect(next.activeVariant).toBe(initialState.activeVariant);
  });
});
