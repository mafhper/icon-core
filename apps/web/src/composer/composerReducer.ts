import type {
  IconCoreProject,
  IconLayer,
  IconVariant,
  IconTarget,
  Fill,
  ShapeDefinition
} from '@iconcore/shared';
import type { FileLayerAsset } from './utils/fileLayers';

export type ComposerView = 'start' | 'compose' | 'variants' | 'preview' | 'export' | 'audit';

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
  | { type: 'NEW_PROJECT'; payload: { name: string; size: number } }
  | { type: 'LOAD_PROJECT'; payload: IconCoreProject }
  | { type: 'ADD_LAYER'; payload: { asset?: FileLayerAsset; shape?: ShapeDefinition } }
  | { type: 'UPDATE_LAYER'; payload: { id: string; changes: Partial<IconLayer> } }
  | { type: 'REMOVE_LAYER'; payload: { id: string } }
  | { type: 'REORDER_LAYER'; payload: { id: string; newIndex: number } }
  | { type: 'DUPLICATE_LAYER'; payload: { id: string } }
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
  view: 'start',
  project: null,
  activeLayerId: null,
  activeVariant: 'default',
  activeTarget: 'web-favicon',
  enabledTargets: new Set(['web-favicon']),
  isDirty: false,
  zoom: 1,
  showGrid: false,
  maskShape: 'square',
  history: [],
  historyIndex: -1
};

const applyLayerChanges = (layer: IconLayer, changes: Partial<IconLayer>): IconLayer => {
  const result = { ...layer, ...changes };
  if (changes.transform) result.transform = { ...layer.transform, ...changes.transform };
  if (changes.source) result.source = { ...layer.source, ...changes.source };
  if (changes.effects) result.effects = changes.effects;
  return result;
};

const pushHistory = (state: ComposerState, project: IconCoreProject): ComposerState => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(project);
  if (newHistory.length > 50) newHistory.shift();
  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1
  };
};

export const composerReducer = (state: ComposerState, action: ComposerAction): ComposerState => {
  switch (action.type) {
    case 'NEW_PROJECT': {
      const project: IconCoreProject = {
        schemaVersion: 2,
        metadata: { name: action.payload.name, shortName: action.payload.name },
        canvas: {
          size: action.payload.size,
          background: { kind: 'solid', color: '#ffffff' }
        },
        layers: [],
        variants: { default: {} },
        targets: [{ target: 'web-favicon', enabled: true }],
        exportProfile: { outputBaseName: action.payload.name.toLowerCase().replace(/\s+/g, '-'), quality: 0.95, generateReport: false }
      };
      return {
        ...pushHistory(state, project),
        project,
        view: 'compose',
        isDirty: false
      };
    }

    case 'LOAD_PROJECT': {
      return {
        ...pushHistory(state, action.payload),
        project: action.payload,
        view: 'compose',
        isDirty: false
      };
    }

    case 'ADD_LAYER': {
      if (!state.project) return state;
      const id = `layer-${Date.now()}`;
      const asset = action.payload.asset;
      const shape = action.payload.shape;
      const newLayer: IconLayer = {
        id,
        name: asset?.name ?? `Layer ${state.project.layers.length + 1}`,
        kind: shape ? 'shape' : asset?.mimeType === 'image/svg+xml' ? 'svg' : 'image',
        visible: true,
        zIndex: state.project.layers.length,
        source: asset
          ? { type: 'inline', mimeType: asset.mimeType, data: asset.data }
          : { type: 'reference', path: '', shape },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        ...(shape ? { fill: { kind: 'solid' as const, color: '#4da3ff' } } : {})
      };
      const updatedProject = {
        ...state.project,
        layers: [...state.project.layers, newLayer]
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        activeLayerId: id,
        isDirty: true
      };
    }

    case 'UPDATE_LAYER': {
      if (!state.project) return state;
      const updatedProject = {
        ...state.project,
        layers: state.project.layers.map(l =>
          l.id === action.payload.id ? applyLayerChanges(l, action.payload.changes) : l
        )
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        isDirty: true
      };
    }

    case 'REMOVE_LAYER': {
      if (!state.project) return state;
      const updatedProject = {
        ...state.project,
        layers: state.project.layers.filter(l => l.id !== action.payload.id)
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        activeLayerId: state.activeLayerId === action.payload.id ? null : state.activeLayerId,
        isDirty: true
      };
    }

    case 'REORDER_LAYER': {
      if (!state.project) return state;
      const layers = [...state.project.layers];
      const currentIndex = layers.findIndex(l => l.id === action.payload.id);
      if (currentIndex === -1) return state;
      const [layer] = layers.splice(currentIndex, 1);
      layers.splice(action.payload.newIndex, 0, layer);
      const updatedProject = {
        ...state.project,
        layers: layers.map((l, i) => ({ ...l, zIndex: i }))
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        isDirty: true
      };
    }

    case 'DUPLICATE_LAYER': {
      if (!state.project) return state;
      const source = state.project.layers.find(l => l.id === action.payload.id);
      if (!source) return state;
      const id = `layer-${Date.now()}`;
      const newLayer: IconLayer = {
        ...source,
        id,
        name: `${source.name} (copy)`,
        zIndex: state.project.layers.length
      };
      const updatedProject = {
        ...state.project,
        layers: [...state.project.layers, newLayer]
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        activeLayerId: id,
        isDirty: true
      };
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      if (!state.project) return state;
      const updatedProject = {
        ...state.project,
        layers: state.project.layers.map(l =>
          l.id === action.payload.id ? { ...l, visible: !l.visible } : l
        )
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        isDirty: true
      };
    }

    case 'TOGGLE_LAYER_LOCK': {
      if (!state.project) return state;
      const updatedProject = {
        ...state.project,
        layers: state.project.layers.map(l =>
          l.id === action.payload.id ? { ...l, locked: !l.locked } : l
        )
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        isDirty: true
      };
    }

    case 'SET_ACTIVE_LAYER': {
      return { ...state, activeLayerId: action.payload.id };
    }

    case 'SET_ACTIVE_VARIANT': {
      return { ...state, activeVariant: action.payload };
    }

    case 'SET_ACTIVE_TARGET': {
      const newEnabled = new Set(state.enabledTargets);
      if (action.payload.enabled) {
        newEnabled.add(action.payload.target);
      } else {
        newEnabled.delete(action.payload.target);
      }
      return { ...state, enabledTargets: newEnabled, activeTarget: action.payload.target };
    }

    case 'SET_CANVAS_BACKGROUND': {
      if (!state.project) return state;
      const updatedProject = {
        ...state.project,
        canvas: { ...state.project.canvas, background: action.payload }
      };
      return {
        ...pushHistory(state, updatedProject),
        project: updatedProject,
        isDirty: true
      };
    }

    case 'NAVIGATE': {
      return { ...state, view: action.payload };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        project: state.history[newIndex],
        historyIndex: newIndex,
        isDirty: true
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        project: state.history[newIndex],
        historyIndex: newIndex,
        isDirty: true
      };
    }

    case 'SET_DIRTY': {
      return { ...state, isDirty: action.payload };
    }

    case 'SET_ZOOM': {
      return { ...state, zoom: action.payload };
    }

    case 'TOGGLE_GRID': {
      return { ...state, showGrid: !state.showGrid };
    }

    case 'SET_MASK_SHAPE': {
      return { ...state, maskShape: action.payload };
    }

    default:
      return state;
  }
};
