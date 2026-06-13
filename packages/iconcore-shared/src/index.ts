export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export type UiTheme = 'light' | 'dark' | 'gold';

export type OutputMode = 'default' | 'themed';

export type ThemedVariant = 'default' | 'light' | 'dark';

// --- v2 types ---

export type IconVariant = 'default' | 'light' | 'dark' | 'mono' | 'highContrast' | 'transparent';

export type IconTarget =
  | 'web-favicon'
  | 'pwa'
  | 'tauri'
  | 'electron'
  | 'desktop-generic'
  | 'marketing';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export type ShapeKind = 'circle' | 'rectangle' | 'rounded-rectangle' | 'squircle' | 'polygon' | 'triangle' | 'line' | 'star';

export interface Fill {
  kind: 'solid' | 'linear-gradient' | 'radial-gradient';
  color?: string;
  stops?: Array<{ offset: number; color: string }>;
  angle?: number;
  /** Radial gradient center, 0..1 of the bounds (default 0.5/0.5). */
  centerX?: number;
  centerY?: number;
  /** Radial gradient radius as a fraction of the max dimension (default 0.5). */
  radius?: number;
}

export interface Stroke {
  color: string;
  width: number;
  alignment: 'center' | 'inside' | 'outside';
}

export type LayerEffectKind =
  | 'depth-shadow'
  | 'inner-lift'
  | 'edge-highlight'
  | 'soft-refraction'
  | 'surface-blur'
  | 'translucent-fill'
  | 'noise-grain'
  | 'adaptive-stroke'
  | 'mono-mapper';

export interface LayerEffect {
  kind: LayerEffectKind;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export interface SafeArea {
  inset: number;
  shape: 'circle' | 'rounded-rectangle' | 'square';
}

export interface Transform2D {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TextDefinition {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

export interface ShapeDefinition {
  kind: ShapeKind;
  width: number;
  height: number;
  cornerRadius?: number;
  points?: Array<{ x: number; y: number }>;
  /** star: number of points (default 5) and inner/outer radius ratio (default 0.5). */
  pointCount?: number;
  innerRatio?: number;
}

export interface LayerSource {
  type: 'inline' | 'reference';
  mimeType?: string;
  data?: string;
  path?: string;
  shape?: ShapeDefinition;
}

export interface IconLayer {
  id: string;
  name: string;
  kind: 'svg' | 'image' | 'shape' | 'text';
  visible: boolean;
  locked?: boolean;
  zIndex: number;
  source: LayerSource;
  transform: Transform2D;
  opacity: number;
  blendMode?: BlendMode;
  fill?: Fill;
  stroke?: Stroke;
  effects?: LayerEffect[];
  text?: TextDefinition;
  variantOverrides?: Partial<Record<IconVariant, Partial<Omit<IconLayer, 'id' | 'variantOverrides'>>>>;
}

export interface VariantOverrides {
  canvas?: {
    background?: Fill;
  };
  layerOverrides?: Record<string, Partial<Omit<IconLayer, 'id' | 'variantOverrides'>>>;
}

export interface TargetConfig {
  target: IconTarget;
  enabled: boolean;
  sizes?: number[];
  formats?: Array<'png' | 'ico' | 'icns' | 'svg' | 'webp'>;
  includeMaskable?: boolean;
  includeManifest?: boolean;
}

export interface ExportProfile {
  outputBaseName: string;
  quality: number;
  generateReport: boolean;
}

export interface IconCoreProject {
  schemaVersion: 2;
  metadata: {
    name: string;
    shortName: string;
    description?: string;
    author?: string;
  };
  canvas: {
    size: number;
    background: Fill;
    safeArea?: SafeArea;
  };
  layers: IconLayer[];
  variants: Partial<Record<IconVariant, VariantOverrides>>;
  targets: TargetConfig[];
  exportProfile: ExportProfile;
}

// --- v1 types (unchanged) ---

export interface ProjectConfig {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  defaultTheme: 'light' | 'dark';
}

export const ICONCORE_REQUEST = 'ICONCORE_REQUEST';
export const ICONCORE_RESPONSE = 'ICONCORE_RESPONSE';

export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en-US', 'es-ES'];

export const BRAND_NAME = 'IconCore';

export const BRAND_COLORS = {
  dark: '#0f1115',
  surface: '#15181e',
  border: '#23262d',
  accent: '#4da3ff'
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  name: 'IconCore App',
  shortName: 'IconCore',
  description: 'Vector asset engine for modern web projects',
  startUrl: '/',
  defaultTheme: 'light'
};

export const detectLocale = (input?: string): Locale => {
  const candidate = (input ?? '').toLowerCase();
  if (candidate.startsWith('es')) return 'es-ES';
  if (candidate.startsWith('en')) return 'en-US';
  if (candidate.startsWith('pt')) return 'pt-BR';
  return 'en-US';
};
