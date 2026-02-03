
export type IconCategory = 'web' | 'ios' | 'pwa' | 'social' | 'windows' | 'macos';
export type IconVariant = 'light' | 'dark' | 'any';
export type AppLanguage = 'pt' | 'en' | 'es' | 'it' | 'fr' | 'de' | 'zh' | 'ja';
export type AppTheme = 'dark' | 'light' | 'tender';
export type NamingStrategy = 'verbose' | 'modern';
export type ExportFramework = 'standard' | 'nextjs' | 'flutter' | 'react-native';

export interface IconDefinition {
  name: string;
  width: number;
  height: number;
  category: IconCategory;
  transparent: boolean;
  maskable?: boolean;
  format: 'png' | 'ico' | 'jpg' | 'svg';
  type: 'logo' | 'favicon' | 'social';
}

export interface ImageAnalysis {
  contrastRatio: number;
  isLowContrast: boolean;
  hasTransparencyIssues: boolean;
  suggestions: string[];
  detectedForegroundColor: string;
  detectedBackgroundColor: string;
}

export interface GeneratedFile {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  size: number;
  category: IconCategory;
  variant: IconVariant;
  width: number;
  height: number;
  originalDef: IconDefinition;
  analysis?: ImageAnalysis;
  typeLabel: 'favicon' | 'logo' | 'social';
}

export const STANDARD_SIZES = [16, 32, 48, 64, 128, 180, 192, 512];
