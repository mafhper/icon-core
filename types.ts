
export type IconCategory = 'web' | 'ios' | 'pwa' | 'social' | 'windows' | 'macos' | 'linux';
export type IconVariant = 'light' | 'dark';
export type AppLanguage = 'pt' | 'en' | 'es' | 'it' | 'fr' | 'de' | 'zh' | 'ja';
export type AppTheme = 'dark' | 'light' | 'design';

export interface IconDefinition {
  name: string;
  width: number;
  height: number;
  category: IconCategory;
  transparent: boolean;
  maskable?: boolean; // For PWA maskable icons (adds padding)
  format: 'png' | 'ico' | 'jpg';
  label?: string; // Human readable label
}

export interface ImageAnalysis {
  contrastRatio: number;
  isLowContrast: boolean;
  hasTransparencyIssues: boolean;
  suggestions: string[];
  detectedForegroundColor: string;
  detectedBackgroundColor: string;
}

export interface EditOptions {
  scale: number;
  padding: number;
  backgroundColor?: string;
  keepOriginalBackground?: boolean;
}

export interface GeneratedFile {
  id: string; // Unique identifier for React keys and updates
  name: string;
  blob: Blob;
  url: string;
  category: IconCategory;
  variant: IconVariant;
  width: number;
  height: number;
  originalDef: IconDefinition; // Reference for re-generating
  analysis?: ImageAnalysis;
}

export const ICON_DEFINITIONS: IconDefinition[] = [
  // Web / Favicon (PNG Fallbacks)
  { name: 'favicon-16x16.png', width: 16, height: 16, category: 'web', transparent: true, format: 'png', label: 'Favicon 16px' },
  { name: 'favicon-32x32.png', width: 32, height: 32, category: 'web', transparent: true, format: 'png', label: 'Favicon 32px' },
  
  // iOS
  { name: 'apple-touch-icon.png', width: 180, height: 180, category: 'ios', transparent: false, format: 'png', label: 'iPhone/iPad Home Screen' },
  
  // PWA
  { name: 'pwa-192x192.png', width: 192, height: 192, category: 'pwa', transparent: true, format: 'png', label: 'PWA Standard' },
  { name: 'pwa-512x512.png', width: 512, height: 512, category: 'pwa', transparent: true, format: 'png', label: 'PWA Splash' },
  { name: 'pwa-maskable-192x192.png', width: 192, height: 192, category: 'pwa', transparent: false, maskable: true, format: 'png', label: 'PWA Maskable (Small)' },
  { name: 'pwa-maskable-512x512.png', width: 512, height: 512, category: 'pwa', transparent: false, maskable: true, format: 'png', label: 'PWA Maskable (Large)' },

  // Social / Open Graph
  { name: 'og-image.jpg', width: 1200, height: 630, category: 'social', transparent: false, format: 'jpg', label: 'Open Graph / Social Card' },

  // Windows (Modern Tiles)
  { name: 'logo-win-150x150.png', width: 150, height: 150, category: 'windows', transparent: true, format: 'png', label: 'Windows Tile Medium' },
  { name: 'logo-win-310x310.png', width: 310, height: 310, category: 'windows', transparent: true, format: 'png', label: 'Windows Tile Large' },
  { name: 'mstile-150x150.png', width: 150, height: 150, category: 'windows', transparent: true, format: 'png', label: 'Web Tile (mstile)' },
  
  // macOS (Source PNGs for ICNS creation tools)
  { name: 'logo-mac-512x512.png', width: 512, height: 512, category: 'macos', transparent: true, format: 'png', label: 'macOS Icon 512px' },
  { name: 'logo-mac-1024x1024.png', width: 1024, height: 1024, category: 'macos', transparent: true, format: 'png', label: 'macOS Icon 1024px' },
  
  // Linux
  { name: 'logo-linux-48x48.png', width: 48, height: 48, category: 'linux', transparent: true, format: 'png', label: 'Linux Icon 48px' },
  { name: 'logo-linux-512x512.png', width: 512, height: 512, category: 'linux', transparent: true, format: 'png', label: 'Linux Icon 512px' },
];
