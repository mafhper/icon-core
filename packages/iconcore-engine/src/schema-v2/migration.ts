import type { Fill, IconLayer, IconTarget, ProjectConfig } from '@iconcore/shared';
import type { IconCoreProject } from '@iconcore/shared';

const DEFAULT_BACKGROUND: Fill = {
  kind: 'solid',
  color: '#ffffff'
};

/**
 * The v2 project shape: identical to the current project except the schema tag.
 * `migrateV1ToV2` produces it; `migrateV2ToV3` turns it into a canonical project.
 */
export type IconCoreProjectV2 = Omit<IconCoreProject, 'schemaVersion'> & { schemaVersion: 2 };

export const migrateV1ToV2 = (
  projectConfig: ProjectConfig,
  sourceDimensions: { width: number; height: number }
): IconCoreProjectV2 => {
  const defaultTargets: Array<{ target: IconTarget; enabled: boolean }> = [
    { target: 'web-favicon', enabled: true },
    { target: 'pwa', enabled: true }
  ];

  return {
    schemaVersion: 2,
    metadata: {
      name: projectConfig.name,
      shortName: projectConfig.shortName,
      description: projectConfig.description
    },
    canvas: {
      size: Math.max(sourceDimensions.width, sourceDimensions.height, 1024),
      background: DEFAULT_BACKGROUND,
      safeArea: {
        inset: 0.1,
        shape: 'rounded-rectangle'
      }
    },
    layers: [
      {
        id: crypto.randomUUID(),
        name: 'Master',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: {
          type: 'reference',
          mimeType: 'image/png',
          path: 'master.png'
        },
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0
        },
        opacity: 1
      }
    ],
    variants: {
      default: {},
      light: {
        canvas: {
          background: { kind: 'solid', color: '#ffffff' }
        }
      },
      dark: {
        canvas: {
          background: { kind: 'solid', color: '#1a1a2e' }
        }
      }
    },
    targets: defaultTargets.map(t => ({
      target: t.target,
      enabled: t.enabled
    })),
    exportProfile: {
      outputBaseName: projectConfig.shortName.toLowerCase().replace(/\s+/g, '-'),
      quality: 0.95,
      generateReport: false
    }
  };
};

/**
 * A legacy "Background" layer is the full-canvas rectangle the old
 * "Add background fill layer" tool created. Shaped layers that merely share the
 * name (e.g. preset circles/squircles) are design elements and must NOT be
 * converted — they stay normal layers.
 */
const isLegacyBackgroundLayer = (layer: IconLayer, size: number): boolean => {
  if (layer.role === 'background') return false;
  if (layer.name.trim().toLowerCase() !== 'background') return false;
  const shape = layer.source?.shape;
  if (!shape || shape.kind !== 'rectangle') return false;
  if (shape.width !== size || shape.height !== size) return false;
  const { x, y, scale, rotation } = layer.transform ?? {};
  if (x !== 0 || y !== 0 || scale !== 1 || rotation !== 0) return false;
  if (layer.stroke) return false;
  if (layer.effects && layer.effects.length > 0) return false;
  return true;
};

const asFill = (value: unknown): Fill => {
  if (typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string') {
    const kind = (value as { kind: string }).kind;
    if (kind === 'solid' || kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'none') {
      return value as Fill;
    }
  }
  return DEFAULT_BACKGROUND;
};

/**
 * Canonicalise the image background (v2 → v3).
 *
 * `canvas.background` remains the single source of truth; the legacy
 * "Background layer" becomes a non-rendering handle (`role: 'background'`) and,
 * when it painted a different fill, that fill is promoted to `canvas.background`
 * so the existing appearance is preserved. Idempotent: running it twice — or on
 * an already-canonical v3 project — yields the same document.
 */
export const migrateV2ToV3 = (input: IconCoreProjectV2 | IconCoreProject): IconCoreProject => {
  if (input.schemaVersion === 3) return input;

  const size = input.canvas.size;
  const alreadyCanonical = input.layers.some((layer) => layer.role === 'background');
  let background = asFill(input.canvas.background);
  let layers = input.layers;

  if (!alreadyCanonical) {
    const index = input.layers.findIndex((layer) => isLegacyBackgroundLayer(layer, size));
    if (index >= 0) {
      const legacy = input.layers[index];
      if (legacy.fill && JSON.stringify(legacy.fill) !== JSON.stringify(background)) {
        background = legacy.fill;
      }
      layers = input.layers.map((layer, i) => {
        if (i !== index) return layer;
        const rest: IconLayer = { ...layer };
        delete rest.fill;
        return { ...rest, role: 'background' as const };
      });
    }
  }

  return {
    ...input,
    schemaVersion: 3,
    canvas: { ...input.canvas, background },
    layers
  };
};

/** Migrate any known project version to the current canonical shape. */
export const migrateToCurrent = (input: IconCoreProjectV2 | IconCoreProject): IconCoreProject =>
  migrateV2ToV3(input);
