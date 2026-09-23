import type {
  ExportArtifactSpec,
  ExportContainerSpec,
  ExportContext,
  ExportPreset,
  IconTarget
} from '@iconcore/shared';

/** Convenience builder for a square PNG raster artifact. */
const raster = (
  id: string,
  path: string,
  size: number,
  extras: Partial<Pick<ExportArtifactSpec, 'background' | 'quality' | 'target' | 'variant'>> = {}
): ExportArtifactSpec => ({
  id,
  format: 'png',
  path,
  enabled: true,
  size,
  ...extras
});

/** Convenience builder for an SVG (vector) artifact. */
const vector = (id: string, path: string, size: number): ExportArtifactSpec => ({
  id,
  format: 'svg',
  path,
  enabled: true,
  size
});

/** Convenience builder for an ICO/ICNS container with physical `entries`. */
const container = (
  id: string,
  path: string,
  format: 'ico' | 'icns',
  entries: number[],
  extras: Partial<Pick<ExportContainerSpec, 'background' | 'target' | 'variant'>> = {}
): ExportContainerSpec => ({
  id,
  path,
  enabled: true,
  format,
  entries,
  ...extras
});

/**
 * Default artifact sets per target (spec §3). These presets are the source of
 * truth for what each integration produces — notably Tauri/Electron now ship
 * real `icon.ico` + `icon.icns` containers instead of PNG-only output.
 */
export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'tauri',
    label: 'Tauri desktop app',
    description: 'Windows/macOS/Linux icons for a Tauri app: icon.ico + icon.icns + Linux PNG set.',
    platforms: ['windows', 'macos', 'linux'],
    recommended: true,
    documentation: 'tauri.conf.json → bundle.icon (icon.ico + icon.icns at source root)',
    createArtifacts: () => [
      raster('tauri-png-512', 'icons/icon.png', 512),
      raster('tauri-png-256', 'icons/128x128@2x.png', 256),
      raster('tauri-png-128', 'icons/128x128.png', 128),
      raster('tauri-png-32', 'icons/32x32.png', 32),
      container('tauri-ico', 'icon.ico', 'ico', [16, 24, 32, 48, 64, 256]),
      container('tauri-icns', 'icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])
    ]
  },
  {
    id: 'electron',
    label: 'Electron desktop app',
    description: 'Source SVG + ICO/ICNS containers + PNG set for electron-builder resources.',
    platforms: ['windows', 'macos', 'linux'],
    documentation: 'electron-builder buildResources (icon.ico, icon.icns, icons/*.png)',
    createArtifacts: () => [
      vector('electron-svg', 'icon.svg', 1024),
      raster('electron-png-512', 'build/icon.png', 512),
      raster('electron-png-128', 'build/icons/128x128.png', 128),
      container('electron-ico', 'build/icon.ico', 'ico', [16, 24, 32, 48, 64, 256]),
      container('electron-icns', 'build/icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])
    ]
  },
  {
    id: 'web',
    label: 'Web favicon set',
    description: 'Favicons for a site: PNG/ICO/SVG plus apple-touch-icon and the manifest/browserconfig pair.',
    platforms: ['web'],
    recommended: true,
    documentation: 'site.webmanifest + browserconfig.xml are produced as attachments',
    createArtifacts: () => [
      raster('web-png-16', 'favicon-16x16.png', 16),
      raster('web-png-32', 'favicon-32x32.png', 32),
      raster('web-png-48', 'favicon-48x48.png', 48),
      raster('web-png-180', 'apple-touch-icon-180x180.png', 180),
      container('web-ico', 'favicon.ico', 'ico', [16, 32]),
      vector('web-svg', 'favicon.svg', 1024)
    ]
  },
  {
    id: 'pwa',
    label: 'PWA install icons',
    description: 'Install icons (192/512) plus an opaque maskable version, with the web manifest.',
    platforms: ['web'],
    recommended: true,
    createArtifacts: () => [
      raster('pwa-png-192', 'icon-192x192.png', 192),
      raster('pwa-png-512', 'icon-512x512.png', 512),
      raster('pwa-maskable-512', 'icon-maskable-512x512.png', 512, { background: 'opaque' })
    ]
  },
  {
    id: 'windows',
    label: 'Windows app icon',
    description: 'Single ICO with the classic Windows size ladder (16–256).',
    platforms: ['windows'],
    createArtifacts: () => [container('windows-ico', 'icon.ico', 'ico', [16, 24, 32, 48, 64, 256])]
  },
  {
    id: 'macos',
    label: 'macOS app icon',
    description: 'Single ICNS containing the full Apple size ladder (16–1024).',
    platforms: ['macos'],
    createArtifacts: () => [container('macos-icns', 'icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])]
  },
  {
    id: 'desktop-generic',
    label: 'Linux icon set',
    description: 'Plain PNG icon set for Linux desktops/freedesktop (32/128/256/512).',
    platforms: ['linux'],
    createArtifacts: () => [
      raster('linux-png-32', 'linux/32x32.png', 32),
      raster('linux-png-128', 'linux/128x128.png', 128),
      raster('linux-png-256', 'linux/256x256.png', 256),
      raster('linux-png-512', 'linux/512x512.png', 512)
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing / social icons',
    description: 'Large PNGs (256/512/1024) for web and social previews.',
    platforms: ['web'],
    createArtifacts: () => [
      raster('marketing-png-256', 'marketing/icon-256.png', 256),
      raster('marketing-png-512', 'marketing/icon-512.png', 512),
      raster('marketing-png-1024', 'marketing/icon-1024.png', 1024)
    ]
  },
  {
    id: 'custom',
    label: 'Custom (start empty)',
    description: 'Start from a blank plan and add artifacts yourself.',
    platforms: [],
    createArtifacts: () => []
  }
];

/** Maps the legacy `IconTarget` ids to the preset that supersedes them. */
export const PRESET_ID_BY_TARGET: Record<IconTarget, string> = {
  'web-favicon': 'web',
  pwa: 'pwa',
  tauri: 'tauri',
  electron: 'electron',
  'desktop-generic': 'desktop-generic',
  marketing: 'marketing'
};

/** Re-export the context type so callers don't have to reach into shared. */
export type { ExportContext };