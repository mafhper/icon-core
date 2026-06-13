import type { IconCoreProject, IconLayer, IconTarget } from '@iconcore/shared';
import type { FileLayerAsset } from './fileLayers';
import { brandGradientFill } from '../constants';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'icon-core-project';

export const DEFAULT_TARGETS: IconTarget[] = [
  'web-favicon',
  'pwa',
  'tauri',
  'electron',
  'desktop-generic',
  'marketing'
];

export const createBlankProject = (name: string, size = 512): IconCoreProject => ({
  schemaVersion: 2,
  metadata: {
    name,
    shortName: name.slice(0, 12)
  },
  canvas: {
    size,
    background: { kind: 'solid', color: '#f8fafc' },
    safeArea: { inset: 0.08, shape: 'rounded-rectangle' }
  },
  layers: [],
  variants: {
    default: {},
    light: { canvas: { background: { kind: 'solid', color: '#f8fafc' } } },
    dark: { canvas: { background: { kind: 'solid', color: '#111827' } } },
    mono: { canvas: { background: { kind: 'solid', color: '#ffffff' } } }
  },
  targets: DEFAULT_TARGETS.map((target) => ({ target, enabled: target === 'web-favicon' || target === 'pwa' })),
  exportProfile: {
    outputBaseName: slugify(name),
    quality: 0.95,
    generateReport: true
  }
});

export const createLayerFromAsset = (
  asset: FileLayerAsset,
  canvasSize: number,
  zIndex: number
): IconLayer => {
  const fitScale = Math.min(0.78, canvasSize / Math.max(asset.width, asset.height));
  const width = Math.max(32, Math.round(asset.width * fitScale));
  const height = Math.max(32, Math.round(asset.height * fitScale));

  return {
    id: `layer-${crypto.randomUUID()}`,
    name: asset.name,
    kind: asset.mimeType === 'image/svg+xml' ? 'svg' : 'image',
    visible: true,
    zIndex,
    source: {
      type: 'inline',
      mimeType: asset.mimeType,
      data: asset.data,
      shape: { kind: 'rectangle', width, height }
    },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1
  };
};

export const createShapeLayer = (canvasSize: number, zIndex: number): IconLayer => ({
  id: `layer-${crypto.randomUUID()}`,
  name: `Shape ${zIndex + 1}`,
  kind: 'shape',
  visible: true,
  zIndex,
  source: {
    type: 'reference',
    path: '',
    shape: {
      kind: 'squircle',
      width: Math.round(canvasSize * 0.46),
      height: Math.round(canvasSize * 0.46),
      cornerRadius: Math.round(canvasSize * 0.1)
    }
  },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: brandGradientFill(),
  effects: [
    { kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' } }
  ]
});

export const createTextLayer = (canvasSize: number, zIndex: number): IconLayer => ({
  id: `layer-${crypto.randomUUID()}`,
  name: `Text ${zIndex + 1}`,
  kind: 'text',
  visible: true,
  zIndex,
  source: {
    type: 'reference',
    path: '',
    shape: {
      kind: 'rectangle',
      width: Math.round(canvasSize * 0.58),
      height: Math.round(canvasSize * 0.2)
    }
  },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#111827' },
  text: {
    content: 'Icon',
    fontFamily: 'Inter, Sora, system-ui, sans-serif',
    fontSize: Math.round(canvasSize * 0.13),
    fontWeight: 700
  }
});

export const createProjectFromAsset = (asset: FileLayerAsset, name = asset.name): IconCoreProject => {
  const project = createBlankProject(name, 512);
  const layer = createLayerFromAsset(asset, project.canvas.size, 0);
  return {
    ...project,
    layers: [layer]
  };
};
