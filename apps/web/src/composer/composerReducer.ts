import type {
  IconCoreProject,
  IconLayer,
  IconVariant,
  IconTarget,
  Fill,
  ShapeDefinition
} from '@iconcore/shared';
import type { FileLayerAsset } from './utils/fileLayers';
import {
  createBlankProject,
  createLayerFromAsset,
  createShapeLayer,
  createTextLayer,
  DEFAULT_TARGETS
} from './utils/projectFactory';

export type PublicRoute = 'workspaces' | 'edit-space' | 'export-utilities';
export type WorkspaceId = 'create-edit' | 'upload-export' | 'upload-edit-export';
export type ComposerView = PublicRoute;

export interface ComposerState {
  view: ComposerView;
  project: IconCoreProject | null;
  activeLayerId: string | null;
  activeVariant: IconVariant;
  activeTarget: IconTarget;
  enabledTargets: Set<IconTarget>;
  isDirty: boolean;
  zoom: number;
  showGrid: boolean;
  maskShape: 'square' | 'circle' | 'rounded-rectangle' | 'squircle';
  history: IconCoreProject[];
  historyIndex: number;
}

export type ComposerAction =
  | { type: 'NEW_PROJECT'; payload: { name: string; size: number; view?: ComposerView } }
  | { type: 'LOAD_PROJECT'; payload: { project: IconCoreProject; view?: ComposerView } | IconCoreProject }
  | { type: 'ADD_LAYER'; payload: { asset?: FileLayerAsset; shape?: ShapeDefinition; text?: boolean } }
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
  | { type: 'SET_ACTIVE_VARIANT'; payload: IconVariant }
  | { type: 'SET_ACTIVE_TARGET'; payload: { target: IconTarget; enabled: boolean } }
  | { type: 'SET_CANVAS_BACKGROUND'; payload: Fill }
  | { type: 'NAVIGATE'; payload: ComposerView }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_MASK_SHAPE'; payload: 'square' | 'circle' | 'rounded-rectangle' | 'squircle' };

export const initialState: ComposerState = {
  view: 'workspaces',
  project: null,
  activeLayerId: null,
  activeVariant: 'default',
  activeTarget: 'web-favicon',
  enabledTargets: new Set(['web-favicon', 'pwa']),
  isDirty: false,
  zoom: 1,
  showGrid: true,
  maskShape: 'rounded-rectangle',
  history: [],
  historyIndex: -1
};

export const normalizeRoute = (value: string): ComposerView => {
  if (value === 'composer' || value === 'compose' || value === 'start') return 'edit-space';
  if (value === 'export') return 'export-utilities';
  if (value === 'edit-space' || value === 'export-utilities' || value === 'workspaces') return value;
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

const setProject = (state: ComposerState, project: IconCoreProject, view: ComposerView): ComposerState => ({
  ...commitProject(state, project),
  project,
  view,
  activeLayerId: project.layers[project.layers.length - 1]?.id ?? null,
  enabledTargets: enabledTargetsFromProject(project),
  isDirty: false
});

const updateProjectTargets = (project: IconCoreProject, target: IconTarget, enabled: boolean): IconCoreProject => {
  const existing = project.targets.some((entry) => entry.target === target)
    ? project.targets
    : [...project.targets, { target, enabled: false }];

  return {
    ...project,
    targets: existing.map((entry) => entry.target === target ? { ...entry, enabled } : entry)
  };
};

const reorderLayers = (layers: IconLayer[]): IconLayer[] =>
  layers.map((layer, index) => ({ ...layer, zIndex: index }));

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
      return setProject(state, payload.project, payload.view ?? 'edit-space');
    }

    case 'ADD_LAYER': {
      if (!state.project) return state;
      const zIndex = state.project.layers.length;
      const layer = action.payload.asset
        ? createLayerFromAsset(action.payload.asset, state.project.canvas.size, zIndex)
        : action.payload.text
          ? createTextLayer(state.project.canvas.size, zIndex)
          : action.payload.shape
            ? {
                ...createShapeLayer(state.project.canvas.size, zIndex),
                source: { type: 'reference' as const, path: '', shape: action.payload.shape }
              }
            : createShapeLayer(state.project.canvas.size, zIndex);
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
        activeLayerId: state.activeLayerId === action.payload.id ? null : state.activeLayerId
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

    case 'SET_ACTIVE_VARIANT':
      return { ...state, activeVariant: action.payload };

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

    case 'SET_CANVAS_BACKGROUND': {
      if (!state.project) return state;
      return commitProject(state, {
        ...state.project,
        canvas: { ...state.project.canvas, background: action.payload }
      });
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

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'SET_MASK_SHAPE':
      return { ...state, maskShape: action.payload };

    default:
      return state;
  }
};
