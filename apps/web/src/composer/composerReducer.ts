import type {
  IconCoreProject,
  IconLayer,
  IconVariant,
  IconTarget,
  Fill,
  ShapeDefinition,
  ExportProfile
} from '@iconcore/shared';
import type { FileLayerAsset } from './utils/fileLayers';
import { clampZoom } from './constants';
import type { WorkAreaColor } from './utils/workArea';
import { generateVariantPreset, isGeneratableVariant } from './utils/variantPresets';
import {
  createBackgroundLayer,
  createBlankProject,
  createLayerFromAsset,
  createShapeLayer,
  createTextLayer,
  DEFAULT_TARGETS
} from './utils/projectFactory';

export type PublicRoute = 'workspaces' | 'edit-space' | 'export-utilities' | 'ui';
export type WorkspaceId = 'create-edit' | 'upload-export' | 'upload-edit-export';
export type ComposerView = PublicRoute;

export interface ComposerState {
  view: ComposerView;
  project: IconCoreProject | null;
  /**
   * Storage identity of the open project, minted fresh on every explicit
   * replacement (`NEW_PROJECT` and `LOAD_PROJECT`, the only callers of
   * `setProject`) and never touched by an edit.
   *
   * **Why this is in the state and not in a ref.** A first version kept it in a
   * ref inside `ComposerProvider`, set once when the restore finished. A ref cannot
   * see a dispatch, so "New project" reused the restored project's id and the
   * autosave overwrote that record — reintroducing exactly the silent destruction
   * #198 removed, one layer down: the guard stopped the `localStorage` slot from
   * being clobbered while the IndexedDB record was clobbered anyway.
   *
   * An `IconCoreProject` has no stable identity of its own, and `state.project`
   * changes identity on every edit, so neither could have carried this. Minting it
   * where the project is deliberately replaced is the only place the distinction
   * between "a different project" and "an edit" actually exists.
   */
  projectId: string | null;
  activeLayerId: string | null;
  renamingLayerId: string | null;
  activeVariant: IconVariant;
  activeTarget: IconTarget;
  enabledTargets: Set<IconTarget>;
  isDirty: boolean;
  zoom: number;
  showGrid: boolean;
  maskShape: 'square' | 'circle' | 'rounded-rectangle' | 'squircle';
  compareDefault: boolean;
  showKeylines: boolean;
  showSnapping: boolean;
  /**
 * A cor da bancada em volta do ícone.
 *
 * **Troca de forma**: era `'dots' | 'grid' | 'plain'`, e virou cor. O motivo não é
 * só gosto — `plain` já **era** uma cor escrita como se fosse um tipo (um gradiente
 * fixo de duas misturas de `--ic-bg` com um literal), e `dots`/`grid` eram texturas que
 * ninguém ia usar num editor de ícone. Ver `utils/workArea.ts` para o porque do
 * `color-mix` e do fallback no token.
 *
 * `null` = "ainda não escolhido", e vale `--ic-bg`. Ver `workAreaToCss`.
 */
  workAreaColor: WorkAreaColor | null;
  history: IconCoreProject[];
  historyIndex: number;
}

/**
 * `ADD_LAYER` e um **tipo fechado**, nao uma bolsa de opcionais.
 *
 * Antes o payload era `{ asset?; shape?; text?; background? }` — todos opcionais, o que
 * o torna um *weak type*: uma chamada com `{ layer: ... }`, que e semanticamente
 * invalida, era aceita em silencio. Aconteceu: um teste do `IC63/2` despachou
 * `payload: { layer: createTextLayer(...) }` e rodou.
 *
 * A explicacao de que "o TypeScript aceitou porque os campos sao opcionais" estava
 * **errada** — e o Agente B, ao revisar, apontou isso. *Weak type detection* reprovaria.
 * A razao real: `vitest` descarta tipos sem checar, e `typecheck` nao tinha sido rodado.
 * Por isso a correcao tem duas partes, e a segunda importa mais que a primeira:
 *
 * 1. uniao discriminada — o compilador passa a **impedir** a classe de erro;
 * 2. `scripts/check-add-layer-payload-types.mjs` — prova com `tsc` que a forma errada
 *    ainda e reprovada. Um teste que so vale porque o compilador recusa nao e verificado
 *    por runner de teste.
 *
 * O `kind` e o discriminante porque ele **aparece no payload**: da para olhar o objeto e
 * saber o que ele cria, e o `switch` do reducer fica exaustivo por compilacao.
 */
export type AddLayerPayload =
  | { kind: 'asset'; asset: FileLayerAsset }
  | { kind: 'shape'; shape: ShapeDefinition }
  | { kind: 'text' }
  | { kind: 'background' };

export type ComposerAction =
  | { type: 'NEW_PROJECT'; payload: { name: string; size: number; view?: ComposerView } }
  | { type: 'LOAD_PROJECT'; payload: { project: IconCoreProject; view?: ComposerView; projectId?: string } | IconCoreProject }
  | { type: 'ADD_LAYER'; payload: AddLayerPayload }
  | { type: 'UPDATE_LAYER'; payload: { id: string; changes: Partial<IconLayer>; transient?: boolean } }
  | { type: 'UPDATE_LAYER_VARIANT'; payload: { id: string; variant: IconVariant; changes: Partial<Omit<IconLayer, 'id' | 'variantOverrides'>>; transient?: boolean } }
  | { type: 'COMMIT_HISTORY' }
  | { type: 'REMOVE_LAYER'; payload: { id: string } }
  | { type: 'REORDER_LAYER'; payload: { id: string; newIndex: number } }
  | { type: 'MOVE_LAYER'; payload: { id: string; direction: 'forward' | 'backward' | 'front' | 'back' } }
  | { type: 'DUPLICATE_LAYER'; payload: { id: string } }
  | { type: 'RESET_LAYER_TRANSFORM'; payload: { id: string } }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; payload: { id: string } }
  | { type: 'TOGGLE_LAYER_LOCK'; payload: { id: string } }
  | { type: 'SET_ACTIVE_LAYER'; payload: { id: string | null } }
  | { type: 'SET_RENAMING_LAYER'; payload: { id: string | null } }
  | { type: 'SET_ACTIVE_VARIANT'; payload: IconVariant }
  | { type: 'GENERATE_VARIANT'; payload: { variant: IconVariant } }
  | { type: 'CLEAR_VARIANT'; payload: { variant: IconVariant } }
  | { type: 'PROMOTE_VARIANT'; payload: { variant: IconVariant } }
  | { type: 'TOGGLE_COMPARE_DEFAULT' }
  | { type: 'SET_ACTIVE_TARGET'; payload: { target: IconTarget; enabled: boolean } }
  | { type: 'SET_CANVAS_BACKGROUND'; payload: { background: Fill; transient?: boolean } }
  | { type: 'SET_CANVAS_IMPORT_MARGIN'; payload: { margin: number; transient?: boolean } }
  | {
      type: 'SET_CANVAS_MASK_RADIUS';
      /** `null` restores the shape's own default instead of pinning a value. */
      payload: { radius: number | null; transient?: boolean };
    }
  | { type: 'UPDATE_EXPORT_PROFILE'; payload: Partial<ExportProfile> }
  | { type: 'NAVIGATE'; payload: ComposerView }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_DIRTY'; payload: boolean }
  /**
   * Renames the open project **in the document**.
   *
   * Separate from the layer-name field because this is the project's own name: it is
   * what the storage list shows, what the pointer carries, and what the header renders,
   * so all four have to move together.
   */
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'TOGGLE_GRID' }
  | { type: 'TOGGLE_KEYLINES' }
  | { type: 'TOGGLE_SNAPPING' }
  | { type: 'SET_MASK_SHAPE'; payload: 'square' | 'circle' | 'rounded-rectangle' | 'squircle' }
  /**
   * Troca a cor da bancada. `null` volta ao token do tema.
   *
   * `transient` nao existe aqui, e e proposital: a bancada **nao** e documento, entao
   * mexer nela nao pode criar entrada de historico — desfazer um ajuste de cor de
   * editorUndoando o desenho seria um "por que minha forma sumiu" sem resposta.
   */
  | { type: 'SET_WORK_AREA_COLOR'; payload: WorkAreaColor | null };

export const initialState: ComposerState = {
  view: 'workspaces',
  project: null,
  projectId: null,
  activeLayerId: null,
  renamingLayerId: null,
  activeVariant: 'default',
  activeTarget: 'web-favicon',
  enabledTargets: new Set(['web-favicon', 'pwa']),
  isDirty: false,
  zoom: 1,
  showGrid: true,
  maskShape: 'rounded-rectangle',
  workAreaColor: null,
  compareDefault: false,
  showKeylines: false,
  showSnapping: true,
  history: [],
  historyIndex: -1
};

export const normalizeRoute = (value: string): ComposerView => {
  if (value === 'composer' || value === 'compose' || value === 'start') return 'edit-space';
  if (value === 'export') return 'export-utilities';
  if (value === 'edit-space' || value === 'export-utilities' || value === 'workspaces' || value === 'ui') return value;
  return 'workspaces';
};

const enabledTargetsFromProject = (project: IconCoreProject): Set<IconTarget> => {
  const targets = project.targets.length > 0 ? project.targets : DEFAULT_TARGETS.map((target) => ({ target, enabled: false }));
  const enabled = targets.filter((target) => target.enabled).map((target) => target.target);
  return new Set(enabled.length > 0 ? enabled : ['web-favicon']);
};

const applyLayerChanges = (layer: IconLayer, changes: Partial<IconLayer>): IconLayer => {
  const result = { ...layer, ...changes };
  if (changes.transform) result.transform = { ...layer.transform, ...changes.transform };
  if (changes.source) result.source = { ...layer.source, ...changes.source };
  if (changes.text) result.text = { ...layer.text, ...changes.text } as IconLayer['text'];
  if (changes.fill) result.fill = changes.fill;
  if (changes.stroke) result.stroke = changes.stroke;
  if (changes.effects) result.effects = changes.effects;
  return result;
};

const commitProject = (state: ComposerState, project: IconCoreProject): ComposerState => {
  const last = state.history[state.historyIndex];
  const nextHistory = last === project
    ? state.history
    : [...state.history.slice(0, state.historyIndex + 1), project].slice(-50);

  return {
    ...state,
    project,
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
    isDirty: true
  };
};

/**
 * A storage id for a project that is replacing another.
 *
 * Unique within one browser profile, which is the scope that matters: the id is the
 * IndexedDB key and the pointer target, never anything that leaves the machine.
 *
 * `crypto.randomUUID` without a fallback, deliberately: `createShapeLayer` and the
 * other factories in `projectFactory.ts` already depend on it the same way, and a
 * reducer that invents its own fallback would make the id format depend on the
 * environment in a way nothing else in the document does.
 */
const mintProjectId = (): string => `p-${crypto.randomUUID()}`;

const setProject = (state: ComposerState, project: IconCoreProject, view: ComposerView): ComposerState => ({
  ...commitProject(state, project),
  project,
  // Always a new identity. `NEW_PROJECT` and `LOAD_PROJECT` are the only callers,
  // and both mean "this is a different project" — which is exactly when the autosave
  // must stop writing over the previous record.
  projectId: mintProjectId(),
  view,
  // The topmost *content* layer, by zIndex — not `layers[length - 1]`. Array
  // order is not paint order: the Background handle is stored last while
  // carrying the lowest zIndex, so the old expression selected the Background
  // every time a project was opened.
  activeLayerId: topmostContentLayer(project),
  enabledTargets: enabledTargetsFromProject(project),
  isDirty: false
});

/** The front-most layer that actually renders, or `null` for an empty project. */
const topmostContentLayer = (project: IconCoreProject): string | null => {
  const content = project.layers.filter((layer) => layer.role !== 'background');
  if (content.length === 0) return null;
  return content.reduce((top, layer) => (layer.zIndex > top.zIndex ? layer : top)).id;
};

const updateProjectTargets = (project: IconCoreProject, target: IconTarget, enabled: boolean): IconCoreProject => {
  const existing = project.targets.some((entry) => entry.target === target)
    ? project.targets
    : [...project.targets, { target, enabled: false }];

  return {
    ...project,
    targets: existing.map((entry) => entry.target === target ? { ...entry, enabled } : entry)
  };
};

/**
 * `project.variants` without one entry.
 *
 * The key is deleted, not blanked. `Record<IconVariant, …>` is partial, so
 * `variants: { …previous, dark: {} }` still reads as "dark exists" to anything
 * that asks `Object.keys` — which is how a cleared or promoted variant used to
 * come back as a slot in the export screen.
 */
const withoutVariant = (
  variants: IconCoreProject['variants'],
  variant: IconVariant
): IconCoreProject['variants'] => {
  if (!(variant in variants)) return variants;
  const next = { ...variants };
  delete next[variant];
  return next;
};

/**
 * Renumber `zIndex` to a dense ascending sequence, **by zIndex order**.
 *
 * Sorting first is the whole point. Array order and zIndex order are not the
 * same thing: `ADD_LAYER` appends the Background handle to the end of the array
 * while giving it the *lowest* zIndex, because it is a UI handle that must sit
 * at the bottom of the list and never renders. Renumbering by array position
 * therefore handed that handle the topmost zIndex — so deleting any layer
 * floated the Background above the artwork in the sidebar, while the canvas
 * stayed correct (the Background never paints).
 *
 * The Background is additionally pinned last, so "keep it at the bottom" does
 * not depend on whatever zIndex it happens to carry.
 */
const reorderLayers = (layers: IconLayer[]): IconLayer[] => {
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  const content = sorted.filter((layer) => layer.role !== 'background');
  const backgrounds = sorted.filter((layer) => layer.role === 'background');

  // Content gets 0..n-1 ascending; the Background handle is pinned at -1, below
  // everything. Giving it the *last* index would promote it to the top of the
  // list, which is the opposite of what it is for.
  const renumbered = content.map((layer, index) => ({ ...layer, zIndex: index }));
  return [...backgrounds.map((layer) => ({ ...layer, zIndex: -1 })), ...renumbered];
};

const moveLayer = (layers: IconLayer[], id: string, direction: 'forward' | 'backward' | 'front' | 'back'): IconLayer[] => {
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  const index = sorted.findIndex((layer) => layer.id === id);
  if (index === -1) return layers;

  const [layer] = sorted.splice(index, 1);
  if (direction === 'front') sorted.push(layer);
  if (direction === 'back') sorted.unshift(layer);
  if (direction === 'forward') sorted.splice(Math.min(sorted.length, index + 1), 0, layer);
  if (direction === 'backward') sorted.splice(Math.max(0, index - 1), 0, layer);

  return reorderLayers(sorted);
};

export const composerReducer = (state: ComposerState, action: ComposerAction): ComposerState => {
  switch (action.type) {
    case 'NEW_PROJECT': {
      return setProject(
        state,
        createBlankProject(action.payload.name, action.payload.size),
        action.payload.view ?? 'edit-space'
      );
    }

    case 'LOAD_PROJECT': {
      const payload = 'project' in action.payload ? action.payload : { project: action.payload };
      return {
        ...setProject(state, payload.project, payload.view ?? 'edit-space'),
        // The restore knows the record it read, and reusing that id is the whole point:
        // minting a fresh one would make the next autosave write a *second* copy of the
        // project the user just opened. A caller that does not know an id (opening a
        // file, for instance) falls back to the freshly minted one.
        projectId: payload.projectId ?? mintProjectId()
      };
    }

    case 'ADD_LAYER': {
      if (!state.project) return state;

      if (action.payload.kind === 'background') {
        // The Background layer is a single handle for `canvas.background`:
        // re-selecting an existing one, or creating it below every other layer
        // (without shifting their zIndex, since it never renders).
        const existing = state.project.layers.find((layer) => layer.role === 'background');
        if (existing) {
          return { ...state, activeLayerId: existing.id };
        }
        const minZ = state.project.layers.reduce((min, layer) => Math.min(min, layer.zIndex), 0);
        const handle = createBackgroundLayer(state.project.canvas.size, minZ - 1);
        // Inserted at the *front* of the array so array order and zIndex order
        // agree. Appending it (with the lowest zIndex) is what let a later
        // renumber-by-position lift the Background to the top of the list.
        const project = { ...state.project, layers: [handle, ...state.project.layers] };
        return { ...commitProject(state, project), activeLayerId: handle.id };
      }

      // "Above everything", computed from the layers that actually render. The
      // Background handle carries the lowest zIndex, so `layers.length` was not
      // the top: with one artwork plus a background, the next layer landed on
      // z=2 and left a gap that a later renumber had to close.
      const topZ = state.project.layers.reduce((max, layer) => Math.max(max, layer.zIndex), -1);
      const zIndex = topZ + 1;

      // `switch` exaustivo em vez de encadeamento de condicoes. A antiga cascata
      // `asset ? ... : text ? ... : shape ? ... : createShapeLayer(...)` tinha um
      // ramo final implicito: um payload sem nenhum campo caia em "shape vazio" e
      // criava uma layer sem querer. Com a uniao discriminada o default e
      // `never`, e uma forma nova sem treatment vira **erro de compilacao**.
      let layer: IconLayer;
      switch (action.payload.kind) {
        case 'asset':
          layer = createLayerFromAsset(
            action.payload.asset,
            state.project.canvas.size,
            zIndex,
            state.project.canvas.importMargin
          );
          break;
        case 'text':
          layer = createTextLayer(state.project.canvas.size, zIndex);
          break;
        case 'shape':
          layer = {
            ...createShapeLayer(state.project.canvas.size, zIndex),
            source: { type: 'reference' as const, path: '', shape: action.payload.shape }
          };
          break;
        default: {
          const exaustivo: never = action.payload;
          return exaustivo;
        }
      }

      const project = { ...state.project, layers: [...state.project.layers, layer] };
      return { ...commitProject(state, project), activeLayerId: layer.id };
    }

    case 'UPDATE_LAYER': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: state.project.layers.map((layer) =>
          layer.id === action.payload.id ? applyLayerChanges(layer, action.payload.changes) : layer
        )
      };
      return action.payload.transient
        ? { ...state, project, isDirty: true }
        : commitProject(state, project);
    }

    case 'UPDATE_LAYER_VARIANT': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: state.project.layers.map((layer) => {
          if (layer.id !== action.payload.id) return layer;
          const previous = layer.variantOverrides?.[action.payload.variant] ?? {};
          return {
            ...layer,
            variantOverrides: {
              ...layer.variantOverrides,
              [action.payload.variant]: {
                ...previous,
                ...action.payload.changes,
                transform: action.payload.changes.transform
                  ? { ...layer.transform, ...(previous.transform ?? {}), ...action.payload.changes.transform }
                  : previous.transform
              }
            }
          };
        })
      };
      return action.payload.transient
        ? { ...state, project, isDirty: true }
        : commitProject(state, project);
    }

    case 'COMMIT_HISTORY': {
      return state.project ? commitProject(state, state.project) : state;
    }

    case 'REMOVE_LAYER': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: reorderLayers(state.project.layers.filter((layer) => layer.id !== action.payload.id))
      };
      return {
        ...commitProject(state, project),
        activeLayerId: state.activeLayerId === action.payload.id ? null : state.activeLayerId,
        renamingLayerId: state.renamingLayerId === action.payload.id ? null : state.renamingLayerId
      };
    }

    case 'REORDER_LAYER': {
      if (!state.project) return state;
      const layers = [...state.project.layers].sort((a, b) => a.zIndex - b.zIndex);
      const currentIndex = layers.findIndex((layer) => layer.id === action.payload.id);
      if (currentIndex === -1) return state;
      const [layer] = layers.splice(currentIndex, 1);
      layers.splice(action.payload.newIndex, 0, layer);
      return commitProject(state, { ...state.project, layers: reorderLayers(layers) });
    }

    case 'MOVE_LAYER': {
      if (!state.project) return state;
      return commitProject(state, {
        ...state.project,
        layers: moveLayer(state.project.layers, action.payload.id, action.payload.direction)
      });
    }

    case 'DUPLICATE_LAYER': {
      if (!state.project) return state;
      const source = state.project.layers.find((layer) => layer.id === action.payload.id);
      if (!source) return state;
      const layer: IconLayer = {
        ...source,
        id: `layer-${crypto.randomUUID()}`,
        name: `${source.name} copy`,
        zIndex: state.project.layers.length,
        transform: { ...source.transform, x: source.transform.x + 18, y: source.transform.y + 18 }
      };
      const project = { ...state.project, layers: [...state.project.layers, layer] };
      return { ...commitProject(state, project), activeLayerId: layer.id };
    }

    case 'RESET_LAYER_TRANSFORM': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: state.project.layers.map((layer) =>
          layer.id === action.payload.id
            ? { ...layer, transform: { x: 0, y: 0, scale: 1, rotation: 0 } }
            : layer
        )
      };
      return commitProject(state, project);
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: state.project.layers.map((layer) =>
          layer.id === action.payload.id ? { ...layer, visible: !layer.visible } : layer
        )
      };
      return commitProject(state, project);
    }

    case 'TOGGLE_LAYER_LOCK': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        layers: state.project.layers.map((layer) =>
          layer.id === action.payload.id ? { ...layer, locked: !layer.locked } : layer
        )
      };
      return commitProject(state, project);
    }

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayerId: action.payload.id };

    case 'SET_RENAMING_LAYER':
      return { ...state, renamingLayerId: action.payload.id };

    case 'SET_ACTIVE_VARIANT':
      return { ...state, activeVariant: action.payload };

    case 'GENERATE_VARIANT': {
      if (!state.project || !isGeneratableVariant(action.payload.variant)) return state;
      const variant = action.payload.variant;
      const preset = generateVariantPreset(state.project, variant);
      const project: IconCoreProject = {
        ...state.project,
        layers: state.project.layers.map((layer) => ({
          ...layer,
          variantOverrides: {
            ...layer.variantOverrides,
            [variant]: { ...layer.variantOverrides?.[variant], fill: preset.layerFills[layer.id] }
          }
        })),
        variants: {
          ...state.project.variants,
          [variant]: {
            ...state.project.variants[variant],
            canvas: { ...state.project.variants[variant]?.canvas, background: preset.background }
          }
        }
      };
      return commitProject(state, project);
    }

    case 'CLEAR_VARIANT': {
      if (!state.project || action.payload.variant === 'default') return state;
      const variant = action.payload.variant;
      const project: IconCoreProject = {
        ...state.project,
        layers: state.project.layers.map((layer) => {
          if (!layer.variantOverrides?.[variant]) return layer;
          const nextOverrides = { ...layer.variantOverrides };
          delete nextOverrides[variant];
          return { ...layer, variantOverrides: nextOverrides };
        }),
        // Drop the key rather than blanking it: an empty entry still reads as
        // "this variant exists" to `Object.keys`, which is how a cleared variant
        // used to reappear as a slot in the export screen.
        variants: withoutVariant(state.project.variants, variant)
      };
      return commitProject(state, project);
    }

    case 'PROMOTE_VARIANT': {
      if (!state.project || action.payload.variant === 'default') return state;
      const variant = action.payload.variant;
      const variantCanvasBg = state.project.variants[variant]?.canvas?.background;
      const project: IconCoreProject = {
        ...state.project,
        layers: state.project.layers.map((layer) => {
          const override = layer.variantOverrides?.[variant];
          if (!override) return layer;
          const nextOverrides = { ...layer.variantOverrides };
          delete nextOverrides[variant];
          return { ...applyLayerChanges(layer, override), variantOverrides: nextOverrides };
        }),
        canvas: variantCanvasBg ? { ...state.project.canvas, background: variantCanvasBg } : state.project.canvas,
        // The variant's own overrides were merged into the layers above, so it
        // no longer exists as a variant — same reason as CLEAR_VARIANT.
        variants: withoutVariant(state.project.variants, variant)
      };
      return commitProject(state, project);
    }

    case 'TOGGLE_COMPARE_DEFAULT':
      return { ...state, compareDefault: !state.compareDefault };

    case 'SET_ACTIVE_TARGET': {
      const enabledTargets = new Set(state.enabledTargets);
      if (action.payload.enabled) enabledTargets.add(action.payload.target);
      else enabledTargets.delete(action.payload.target);
      const project = state.project
        ? updateProjectTargets(state.project, action.payload.target, action.payload.enabled)
        : null;
      return {
        ...state,
        project,
        enabledTargets,
        activeTarget: action.payload.target,
        isDirty: Boolean(project)
      };
    }

    case 'SET_CANVAS_IMPORT_MARGIN': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        canvas: { ...state.project.canvas, importMargin: Math.max(0, Math.min(0.45, action.payload.margin)) }
      };
      return action.payload.transient
        ? { ...state, project, isDirty: true }
        : commitProject(state, project);
    }

    case 'SET_CANVAS_MASK_RADIUS': {
      if (!state.project) return state;
      const side = state.project.canvas.size;
      const project = {
        ...state.project,
        canvas: {
          ...state.project.canvas,
          // Clamped to half the side: beyond that the corners cross over. `null`
          // clears the field, which restores the shape's own default.
          maskRadius: action.payload.radius === null
            ? undefined
            : Math.max(0, Math.min(side / 2, action.payload.radius))
        }
      };
      return action.payload.transient
        ? { ...state, project, isDirty: true }
        : commitProject(state, project);
    }

    case 'SET_CANVAS_BACKGROUND': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        canvas: { ...state.project.canvas, background: action.payload.background }
      };
      return action.payload.transient
        ? { ...state, project, isDirty: true }
        : commitProject(state, project);
    }

    case 'UPDATE_EXPORT_PROFILE': {
      if (!state.project) return state;
      const project = {
        ...state.project,
        exportProfile: { ...state.project.exportProfile, ...action.payload }
      };
      return { ...state, project, isDirty: true };
    }

    case 'NAVIGATE':
      return { ...state, view: action.payload };

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const historyIndex = state.historyIndex - 1;
      return {
        ...state,
        project: state.history[historyIndex],
        historyIndex,
        isDirty: true
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const historyIndex = state.historyIndex + 1;
      return {
        ...state,
        project: state.history[historyIndex],
        historyIndex,
        isDirty: true
      };
    }

    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };

    case 'SET_PROJECT_NAME': {
      const name = action.payload.trim();
      // A rename is an edit, not a load: `isDirty` stays true so the autosave writes
      // the new name through, and `projectId` is untouched so it lands on the same
      // record rather than minting a second project.
      if (!state.project || !name || state.project.metadata.name === name) return state;
      return {
        ...state,
        project: { ...state.project, metadata: { ...state.project.metadata, name } },
        isDirty: true
      };
    }

    case 'SET_ZOOM':
      return { ...state, zoom: clampZoom(action.payload) };

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'TOGGLE_KEYLINES':
      return { ...state, showKeylines: !state.showKeylines };

    case 'TOGGLE_SNAPPING':
      return { ...state, showSnapping: !state.showSnapping };

    case 'SET_MASK_SHAPE': {
      // The shape belongs to the document, not just to the toolbar: it is part
      // of what the user drew, and the export has to be able to reproduce it.
      // Previously it lived only in `state`, so a shape chosen but not saved was
      // invisible to anything that read the project.
      const base = state.project
        ? {
            ...state,
            project: {
              ...state.project,
              canvas: { ...state.project.canvas, maskShape: action.payload }
            }
          }
        : state;
      return { ...base, maskShape: action.payload };
    }

    case 'SET_WORK_AREA_COLOR':
      // Sem `commitProject` e sem `isDirty`: ver a nota da acao. A bancada nao e arte,
      // e `IC-N7` (digest) nao pode acusar mudanca aqui.
      return { ...state, workAreaColor: action.payload };

    default:
      return state;
  }
};
