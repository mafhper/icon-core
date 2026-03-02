import type { IconManifest, ManifestOptions } from './types';

export const generateManifest = ({
  project,
  mode,
  defaultTheme,
  themeColor,
  backgroundColor
}: ManifestOptions): IconManifest => {
  const baseFolder = mode === 'themed' ? `icons/${defaultTheme}` : 'icons/default';

  return {
    name: project.name,
    short_name: project.shortName,
    description: project.description,
    start_url: project.startUrl,
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: 'any',
    icons: [
      {
        src: `${baseFolder}/pwa-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: `${baseFolder}/pwa-maskable-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: `${baseFolder}/pwa-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: `${baseFolder}/pwa-maskable-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
};
