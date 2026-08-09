import type { Fill, IconTarget, ProjectConfig } from '@iconcore/shared';
import type { IconCoreProject } from '@iconcore/shared';

const DEFAULT_BACKGROUND: Fill = {
  kind: 'solid',
  color: '#ffffff'
};

export const migrateV1ToV2 = (
  projectConfig: ProjectConfig,
  sourceDimensions: { width: number; height: number }
): IconCoreProject => {
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
