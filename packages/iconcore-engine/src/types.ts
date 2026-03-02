import type { OutputMode, ProjectConfig, ThemedVariant } from '@iconcore/shared';

export interface SourceMatrix<T> {
  master: T;
  light?: T;
  dark?: T;
  favicon?: T;
  faviconLight?: T;
  faviconDark?: T;
  socialBackground?: T;
}

export interface ResolvedSources<T> {
  mode: OutputMode;
  logos: {
    default: T;
    light?: T;
    dark?: T;
  };
  favicons: {
    default: T;
    light?: T;
    dark?: T;
  };
  social: {
    logo: T;
    background?: T;
  };
}

export type GenerationKind = 'raster' | 'passthrough' | 'ico';
export type AssetType = 'logo' | 'favicon' | 'social';

export interface GenerationTask<T> {
  kind: GenerationKind;
  type: AssetType;
  variant: ThemedVariant;
  name: string;
  source: T;
  width?: number;
  height?: number;
  format?: 'png' | 'jpg' | 'svg' | 'ico';
  transparent?: boolean;
  maskable?: boolean;
}

export interface BuildPlanOptions {
  includeSocial?: boolean;
  includeFaviconSvg?: boolean;
  opaqueBackground?: boolean;
}

export interface OutputEntry {
  path: string;
  directory: string;
  variant: ThemedVariant;
  type: AssetType;
}

export interface IconManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  orientation: 'any';
  icons: Array<{
    src: string;
    sizes: '192x192' | '512x512';
    type: 'image/png';
    purpose: 'any' | 'maskable';
  }>;
}

export interface ManifestOptions {
  project: ProjectConfig;
  mode: OutputMode;
  defaultTheme: 'light' | 'dark';
  themeColor: string;
  backgroundColor: string;
}
