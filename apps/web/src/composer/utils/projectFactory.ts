import type { IconCoreProject, IconLayer, IconTarget } from '@iconcore/shared';
import { DEFAULT_FONT_STACK } from '@iconcore/renderer';
import type { FileLayerAsset } from './fileLayers';
import { measureIntrinsicSize } from './fileLayers';
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
  schemaVersion: 3,
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

/**
 * Default margin left around a freshly imported asset, as a fraction of the
 * canvas. Zero means the artwork fills the canvas — which is what someone
 * importing a borderless icon expects.
 */
export const DEFAULT_IMPORT_MARGIN = 0;

/** Shortest acceptable *long* side, in canvas px, so tiny assets stay grabbable. */
const MIN_LONG_SIDE = 32;

/**
 * Fit an imported asset into the canvas **without ever changing its aspect
 * ratio**: a single scale drives both axes, and the minimum-size rule raises
 * that same scale instead of being applied per axis. Flooring each axis
 * independently is what used to squish thin assets — a 48×24 asset became
 * 37×32 (ratio 1.16 instead of 2), and the Canvas2D backend stretches the
 * source into exactly this rectangle.
 *
 * The asset **fills the canvas by default** (`margin` 0). A previous version
 * capped the layer at `0.78` of the *source* size rather than the canvas,
 * which meant a 256px icon dropped into a 512px canvas landed at 200px — a
 * 30% band of background on all four sides that nobody asked for, and it scaled
 * with the source rather than being a real margin. The margin is now a
 * deliberate, explicit setting (`canvas.importMargin`), applied to the canvas.
 */
export const fitAssetSize = (
  width: number,
  height: number,
  canvasSize: number,
  margin: number = DEFAULT_IMPORT_MARGIN
): { width: number; height: number } => {
  const naturalWidth = Math.max(1, width);
  const naturalHeight = Math.max(1, height);
  const longest = Math.max(naturalWidth, naturalHeight);
  const usable = canvasSize * Math.max(0, 1 - margin);
  const scale = Math.max(Math.min(usable / longest, Infinity), MIN_LONG_SIDE / longest);
  const round = (value: number): number => Math.max(1, Number(value.toFixed(2)));
  return { width: round(naturalWidth * scale), height: round(naturalHeight * scale) };
};

export const createLayerFromAsset = (
  asset: FileLayerAsset,
  canvasSize: number,
  zIndex: number,
  margin: number = DEFAULT_IMPORT_MARGIN
): IconLayer => {
  const { width, height } = fitAssetSize(asset.width, asset.height, canvasSize, margin);

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

/**
 * `shape` dimensions for an asset whose intrinsic size is `intrinsic`, placed at
 * the same footprint the layer currently occupies.
 *
 * The current **long** side is kept and the other axis is derived from the
 * intrinsic ratio, so a squashed layer straightens without growing or shrinking
 * — the icon keeps its place in the composition.
 */
const shapeAtIntrinsicAspect = (
  current: { width: number; height: number },
  intrinsic: { width: number; height: number }
): { width: number; height: number } => {
  const ratio = intrinsic.width / intrinsic.height;
  if (!Number.isFinite(ratio) || ratio <= 0) return current;

  const long = Math.max(current.width, current.height);
  const round = (value: number): number => Math.max(1, Number(value.toFixed(2)));
  // A landscape asset keeps the long side horizontal; a portrait one vertical.
  return ratio >= 1
    ? { width: round(long), height: round(long / ratio) }
    : { width: round(long * ratio), height: round(long) };
};

/** Outcome of {@link resetLayerAspect}, so the UI can explain a no-op. */
export type ResetAspectResult =
  | { status: 'reset'; layer: IconLayer; from: { width: number; height: number } }
  | { status: 'unchanged' }
  | { status: 'not-applicable' }
  | { status: 'unmeasurable' };

/**
 * "Reset aspect ratio": rewrite a squashed image/SVG
 * layer's `source.shape` to the asset's intrinsic ratio, leaving `transform`
 * untouched. The Canvas2D/SVG backends stretch the source into exactly this
 * rectangle (`layerBaseRect`), so the shape *is* the layer's proportion and
 * fixing it needs no schema change.
 */
export const resetLayerAspect = async (layer: IconLayer): Promise<ResetAspectResult> => {
  if (layer.kind !== 'image' && layer.kind !== 'svg') return { status: 'not-applicable' };
  if (layer.source.type !== 'inline' || !layer.source.data) return { status: 'not-applicable' };

  const shape = layer.source.shape;
  if (!shape) return { status: 'not-applicable' };

  const intrinsic = await measureIntrinsicSize(layer.source.mimeType, layer.source.data);
  if (!intrinsic) return { status: 'unmeasurable' };

  const width = shape.width;
  const height = shape.height;
  const next = shapeAtIntrinsicAspect({ width, height }, intrinsic);

  // Already at the intrinsic ratio (within a 0.5px rounding step) — nothing to do.
  if (Math.abs(next.width - width) < 0.5 && Math.abs(next.height - height) < 0.5) {
    return { status: 'unchanged' };
  }

  return {
    status: 'reset',
    from: { width, height },
    layer: {
      ...layer,
      source: { ...layer.source, shape: { ...shape, width: next.width, height: next.height } }
    }
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

/**
 * The Background layer is the selectable handle for `canvas.background`; it
 * never produces pixels (the renderer skips `role: 'background'`). It keeps a
 * benign full-canvas rectangle source so the generic layer utilities can still
 * measure it, and deliberately carries no `fill`/`effects` — the image
 * background lives in `canvas.background`.
 */
export const createBackgroundLayer = (canvasSize: number, zIndex: number): IconLayer => ({
  id: `layer-${crypto.randomUUID()}`,
  name: 'Background',
  role: 'background',
  kind: 'shape',
  visible: true,
  zIndex,
  source: {
    type: 'reference',
    path: '',
    shape: { kind: 'rectangle', width: canvasSize, height: canvasSize }
  },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1
});

export const createTextLayer = (canvasSize: number, zIndex: number): IconLayer => ({  id: `layer-${crypto.randomUUID()}`,
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
    /**
     * `system-ui`, e nao uma familia de nome proprio.
     *
     * Antes era `'Inter, Sora, system-ui, sans-serif'` — e **nenhuma das duas primeiras
     * estava no projeto**: nao havia um `.woff2` no repositorio. O editor caia no
     * fallback, e o `favicon.svg` / `icon.svg` saiam com o nome de uma fonte que quem
     * abrisse quase nao teria. O preview e o arquivo exportado eram coisas diferentes.
     *
     * O default tem de ser o que **nao falha**: uma familia generica resolve no editor, no
     * PNG e no SVG, em qualquer maquina. Quem quiser desenho com personalidade escolhe Cal
     * Sans no seletor — e ela vem com o app.
     */
    fontFamily: DEFAULT_FONT_STACK,
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
