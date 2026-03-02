export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export type UiTheme = 'light' | 'dark' | 'gold';

export type OutputMode = 'default' | 'themed';

export type ThemedVariant = 'default' | 'light' | 'dark';

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
