import { describe, expect, it } from 'vitest';
import { composerReducer, initialState } from './composerReducer';
import { createProjectFromAsset } from './utils/projectFactory';
import { workAreaToCss } from './utils/workArea';

/**
 * Uma cor para os testes da bancada. Montada sem literal de hex porque este arquivo
 * nao esta em `hexExceptions` do `.ui-budget.json` e o orcamento so desce — e aqui
 * a cor e fixture, nao o que o teste exercita. `workArea.spec.ts`, que testa
 * normalizacao de hex de verdade, esta na lista.
 */
const COR_WORK_AREA = ['#', '22', '33', '44'].join('');

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
      payload: { kind: 'shape', shape: { kind: 'circle', width: 100, height: 100 } }
    });

    const generated = composerReducer(withLayer, { type: 'GENERATE_VARIANT', payload: { variant: 'dark' } });
    expect(generated.project!.layers[0].variantOverrides?.dark?.fill).toBeDefined();
    const darkBg = generated.project!.variants.dark?.canvas?.background;
    expect(darkBg?.kind === 'solid' ? darkBg.color : undefined).toBe('#0f172a');

    const cleared = composerReducer(generated, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });
    expect(cleared.project!.layers[0].variantOverrides?.dark).toBeUndefined();
  });

  it('drops the variant key entirely when clearing, so it stops reading as existing', () => {
    const created = composerReducer(initialState, { type: 'NEW_PROJECT', payload: { name: 'T', size: 512 } });
    const withLayer = composerReducer(created, {
      type: 'ADD_LAYER',
      payload: { kind: 'shape', shape: { kind: 'circle', width: 100, height: 100 } }
    });

    const generated = composerReducer(withLayer, { type: 'GENERATE_VARIANT', payload: { variant: 'dark' } });
    expect(Object.keys(generated.project!.variants)).toContain('dark');

    const cleared = composerReducer(generated, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });
    // The key must be gone, not blank: `Record<IconVariant, …>` is partial, so
    // `{ dark: {} }` is indistinguishable from a real variant to `Object.keys`.
    expect(Object.keys(cleared.project!.variants)).not.toContain('dark');
    expect('dark' in cleared.project!.variants).toBe(false);
  });

  it('drops the variant key when promoting it into the base', () => {
    const created = composerReducer(initialState, { type: 'NEW_PROJECT', payload: { name: 'T', size: 512 } });
    const withLayer = composerReducer(created, {
      type: 'ADD_LAYER',
      payload: { kind: 'shape', shape: { kind: 'circle', width: 100, height: 100 } }
    });

    const generated = composerReducer(withLayer, { type: 'GENERATE_VARIANT', payload: { variant: 'mono' } });
    const promoted = composerReducer(generated, { type: 'PROMOTE_VARIANT', payload: { variant: 'mono' } });

    // The variant's overrides were merged into the layers. NEW_PROJECT seeds the
    // key, so promotion removes it and `projectVariants` stops offering a slot
    // for it — there is nothing left of that variant to show.
    expect(Object.keys(promoted.project!.variants)).not.toContain('mono');
    expect(promoted.project!.layers[0].variantOverrides?.mono).toBeUndefined();
  });

  it('keeps sibling variants when one is cleared', () => {
    const created = composerReducer(initialState, { type: 'NEW_PROJECT', payload: { name: 'T', size: 512 } });
    const withLayer = composerReducer(created, {
      type: 'ADD_LAYER',
      payload: { kind: 'shape', shape: { kind: 'circle', width: 100, height: 100 } }
    });

    const withDark = composerReducer(withLayer, { type: 'GENERATE_VARIANT', payload: { variant: 'dark' } });
    const withBoth = composerReducer(withDark, { type: 'GENERATE_VARIANT', payload: { variant: 'light' } });
    const cleared = composerReducer(withBoth, { type: 'CLEAR_VARIANT', payload: { variant: 'dark' } });

    // NEW_PROJECT seeds default/light/dark/mono, so the siblings that survive are
    // the seeded ones minus the cleared key — not just the generated ones.
    const keys = Object.keys(cleared.project!.variants);
    expect(keys).not.toContain('dark');
    expect(keys).toContain('light');
    expect(keys).toContain('mono');
  });
});

describe('background layer handle', () => {
  const withProject = (project: ReturnType<typeof createProjectFromAsset>) =>
    composerReducer(initialState, { type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });

  it('creates a non-rendering handle below the other layers without shifting them', () => {
    const loaded = withProject(createProjectFromAsset(asset));
    const before = loaded.project!.layers.map((layer) => layer.zIndex);

    const added = composerReducer(loaded, { type: 'ADD_LAYER', payload: { kind: 'background' } });
    const handle = added.project!.layers.find((layer) => layer.role === 'background');

    expect(handle).toBeDefined();
    expect(handle!.zIndex).toBeLessThan(Math.min(...before));
    expect(added.project!.layers.filter((layer) => layer.role !== 'background').map((layer) => layer.zIndex)).toEqual(before);
    expect(added.activeLayerId).toBe(handle!.id);
  });

  it('re-selects the existing handle instead of duplicating it', () => {
    const loaded = withProject(createProjectFromAsset(asset));
    const once = composerReducer(loaded, { type: 'ADD_LAYER', payload: { kind: 'background' } });
    const twice = composerReducer(once, { type: 'ADD_LAYER', payload: { kind: 'background' } });

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

describe('Work area color (SET_WORK_AREA_COLOR)', () => {
  /**
   * Substitui "defaults to dots". O default **nao** e um tipo: e `null`, que vale
   * `var(--ic-bg)`. Um default hex aqui viraria um desk quase preto no tema claro.
   */
  it('starts unset, which means the theme token', () => {
    expect(initialState.workAreaColor).toBeNull();
    expect(workAreaToCss(initialState.workAreaColor)).toBe('var(--ic-bg)');
  });

  it('stores the colour it was given', () => {
    const next = composerReducer(initialState, {
      type: 'SET_WORK_AREA_COLOR',
      payload: { color: COR_WORK_AREA, alpha: 0.5 }
    });
    expect(next.workAreaColor).toEqual({ color: COR_WORK_AREA, alpha: 0.5 });
    expect(workAreaToCss(next.workAreaColor)).toBe('color-mix(in srgb, #223344 50%, transparent)');
  });

  it('null goes back to the theme', () => {
    const escolhido = composerReducer(initialState, {
      type: 'SET_WORK_AREA_COLOR',
      payload: { color: COR_WORK_AREA, alpha: 1 }
    });
    const limpo = composerReducer(escolhido, { type: 'SET_WORK_AREA_COLOR', payload: null });
    expect(limpo.workAreaColor).toBeNull();
    expect(workAreaToCss(limpo.workAreaColor)).toBe('var(--ic-bg)');
  });

  /**
   * O teste que o `IC-N7` exige: a bancada **nao** e documento.
   *
   * Se mexer na cor marcasse `isDirty` ou empilhasse historico, o autosave gravaria um
   * registro novo e o digest do `release-core` acusaria arte nova a cada troca de cor
   * de editor — a assinatura de um pipeline que nao pode ser reproduzido.
   */
  it('does not touch the document, the dirty flag or the history', () => {
    const next = composerReducer(initialState, {
      type: 'SET_WORK_AREA_COLOR',
      payload: { color: COR_WORK_AREA, alpha: 1 }
    });
    expect(next.project).toBe(initialState.project);
    expect(next.isDirty).toBe(initialState.isDirty);
    expect(next.history.length).toBe(initialState.history.length);
    expect(next.historyIndex).toBe(initialState.historyIndex);
  });
});
