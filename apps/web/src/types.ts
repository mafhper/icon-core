import type { Locale, OutputMode, ProjectConfig, ThemedVariant, UiTheme } from '@iconcore/shared';

export type UploadSlot =
  | 'master'
  | 'light'
  | 'dark'
  | 'favicon'
  | 'faviconLight'
  | 'faviconDark'
  | 'socialBackground';

export interface UploadEntry {
  file: File | null;
  previewUrl: string | null;
}

export type UploadState = Record<UploadSlot, UploadEntry>;

export type MasterSourceMode = 'default' | 'both' | 'light' | 'dark';

export interface GeneratorSettings {
  logoPadding: number;
  faviconPadding: number;
  socialPadding: number;
  transparentBackground: boolean;
  backgroundColor: string;
  darkBackgroundColor: string;
  includeSocial: boolean;
}

export interface AppPreferences {
  outputMode: 'auto' | OutputMode;
  includeLogoSvg: boolean;
  includeFaviconSvg: boolean;
  includeIco: boolean;
  outputStructure: 'standard' | 'flat';
  archiveName: string;
}

export interface GeneratedArtifact {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  size: number;
  width: number;
  height: number;
  variant: ThemedVariant;
  type: 'logo' | 'favicon' | 'social';
}

export interface AppState {
  locale: Locale;
  theme: UiTheme;
  projectConfig: ProjectConfig;
  uploads: UploadState;
  settings: GeneratorSettings;
  preferences: AppPreferences;
}

export const createInitialUploads = (): UploadState => ({
  master: { file: null, previewUrl: null },
  light: { file: null, previewUrl: null },
  dark: { file: null, previewUrl: null },
  favicon: { file: null, previewUrl: null },
  faviconLight: { file: null, previewUrl: null },
  faviconDark: { file: null, previewUrl: null },
  socialBackground: { file: null, previewUrl: null }
});
