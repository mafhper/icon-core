import type { IconTarget } from '@iconcore/shared';

export interface TargetDefinition {
  id: IconTarget;
  label: string;
  description: string;
  defaultSizes: number[];
  defaultFormats: Array<'png' | 'ico' | 'icns' | 'svg'>;
  includeMaskable: boolean;
  includeManifest: boolean;
  outputStructure: 'nested' | 'flat';
  iconSubDir: string;
  manifestFileName: string;
  extraFiles: Array<{ name: string; generator: 'manifest' | 'browserconfig' | 'none' }>;
}

export const TARGET_REGISTRY: Record<IconTarget, TargetDefinition> = {
  'web-favicon': {
    id: 'web-favicon',
    label: 'Web / Favicons',
    description: 'Favicons, Apple touch icons, and web manifest for browsers',
    defaultSizes: [16, 32, 48, 120, 152, 180],
    defaultFormats: ['png', 'ico', 'svg'],
    includeMaskable: false,
    includeManifest: true,
    outputStructure: 'flat',
    iconSubDir: '',
    manifestFileName: 'site.webmanifest',
    extraFiles: [
      { name: 'browserconfig.xml', generator: 'browserconfig' }
    ]
  },

  'pwa': {
    id: 'pwa',
    label: 'PWA',
    description: 'Progressive Web App icons and manifest',
    defaultSizes: [192, 512],
    defaultFormats: ['png'],
    includeMaskable: true,
    includeManifest: true,
    outputStructure: 'nested',
    iconSubDir: 'icons',
    manifestFileName: 'manifest.webmanifest',
    extraFiles: []
  },

  'tauri': {
    id: 'tauri',
    label: 'Tauri',
    description: 'Icons for Tauri desktop apps (src-tauri/icons)',
    defaultSizes: [32, 128, 256, 512],
    defaultFormats: ['png', 'ico', 'icns'],
    includeMaskable: false,
    includeManifest: false,
    outputStructure: 'flat',
    iconSubDir: '',
    manifestFileName: '',
    extraFiles: []
  },

  'electron': {
    id: 'electron',
    label: 'Electron',
    description: 'Icons for Electron desktop apps (build/)',
    defaultSizes: [256, 512],
    defaultFormats: ['png', 'ico', 'icns'],
    includeMaskable: false,
    includeManifest: false,
    outputStructure: 'nested',
    iconSubDir: 'icons',
    manifestFileName: '',
    extraFiles: []
  },

  'desktop-generic': {
    id: 'desktop-generic',
    label: 'Desktop (Generic)',
    description: 'Icons for Windows, macOS, and Linux desktop apps',
    defaultSizes: [16, 32, 48, 64, 128, 256, 512],
    defaultFormats: ['png', 'ico', 'icns'],
    includeMaskable: false,
    includeManifest: false,
    outputStructure: 'nested',
    iconSubDir: '',
    manifestFileName: '',
    extraFiles: []
  },

  'marketing': {
    id: 'marketing',
    label: 'Marketing',
    description: 'High-resolution icons for marketing, social media, and Open Graph',
    defaultSizes: [256, 512, 1024],
    defaultFormats: ['png'],
    includeMaskable: false,
    includeManifest: false,
    outputStructure: 'nested',
    iconSubDir: 'marketing',
    manifestFileName: '',
    extraFiles: []
  }
};