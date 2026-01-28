
export type IconCategory = 'web' | 'ios' | 'pwa' | 'social' | 'windows' | 'macos' | 'linux';
export type IconVariant = 'light' | 'dark';
export type AppLanguage = 'pt' | 'en' | 'es' | 'it' | 'fr' | 'de' | 'zh' | 'ja';
export type AppTheme = 'dark' | 'light' | 'design';

// Dynamic definition structure
export interface IconDefinition {
  name: string; // The output filename
  width: number;
  height: number;
  category: IconCategory;
  transparent: boolean;
  maskable?: boolean;
  format: 'png' | 'ico' | 'jpg' | 'svg';
  label?: string;
  type: 'logo' | 'favicon' | 'social'; // Grouping
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
  quality?: number;
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

// Default standard sizes to offer
export const STANDARD_SIZES = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512];
