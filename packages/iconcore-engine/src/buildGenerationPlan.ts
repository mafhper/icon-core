import type { BuildPlanOptions, GenerationTask, ResolvedSources } from './types';

const APPLE_SIZES = [180, 152, 120] as const;
const FAVICON_SIZES = [16, 32, 48] as const;
const PWA_SIZES = [192, 512] as const;

const addVariantTasks = <T>(
  tasks: Array<GenerationTask<T>>,
  prefix: string,
  variant: 'default' | 'light' | 'dark',
  logoSource: T,
  faviconSource: T,
  options: Required<BuildPlanOptions>
) => {
  for (const size of FAVICON_SIZES) {
    tasks.push({
      kind: 'raster',
      type: 'favicon',
      variant,
      name: `${prefix}/favicon-${size}x${size}.png`,
      source: faviconSource,
      width: size,
      height: size,
      format: 'png',
      transparent: true
    });
  }

  tasks.push({
    kind: 'ico',
    type: 'favicon',
    variant,
    name: `${prefix}/favicon.ico`,
    source: faviconSource,
    format: 'ico'
  });

  if (options.includeFaviconSvg) {
    tasks.push({
      kind: 'passthrough',
      type: 'favicon',
      variant,
      name: `${prefix}/favicon.svg`,
      source: faviconSource,
      format: 'svg'
    });
  }

  for (const size of APPLE_SIZES) {
    tasks.push({
      kind: 'raster',
      type: 'logo',
      variant,
      name: `${prefix}/${size === 180 ? 'apple-touch-icon' : `apple-touch-icon-${size}x${size}`}.png`,
      source: logoSource,
      width: size,
      height: size,
      format: 'png',
      transparent: false
    });
  }

  for (const size of PWA_SIZES) {
    tasks.push({
      kind: 'raster',
      type: 'logo',
      variant,
      name: `${prefix}/pwa-${size}x${size}.png`,
      source: logoSource,
      width: size,
      height: size,
      format: 'png',
      transparent: !options.opaqueBackground
    });

    tasks.push({
      kind: 'raster',
      type: 'logo',
      variant,
      name: `${prefix}/pwa-maskable-${size}x${size}.png`,
      source: logoSource,
      width: size,
      height: size,
      format: 'png',
      transparent: false,
      maskable: true
    });
  }
};

export const buildGenerationPlan = <T>(
  resolved: ResolvedSources<T>,
  options: BuildPlanOptions = {}
): Array<GenerationTask<T>> => {
  const effective: Required<BuildPlanOptions> = {
    includeSocial: options.includeSocial ?? true,
    includeFaviconSvg: options.includeFaviconSvg ?? true,
    opaqueBackground: options.opaqueBackground ?? false
  };

  const tasks: Array<GenerationTask<T>> = [];

  tasks.push({
    kind: 'passthrough',
    type: 'logo',
    variant: 'default',
    name: 'assets/logo.svg',
    source: resolved.logos.default,
    format: 'svg'
  });

  tasks.push({
    kind: 'raster',
    type: 'logo',
    variant: 'default',
    name: 'assets/logo.png',
    source: resolved.logos.default,
    width: 1024,
    height: 1024,
    format: 'png',
    transparent: true
  });

  if (resolved.mode === 'themed' && resolved.logos.light && resolved.logos.dark && resolved.favicons.light && resolved.favicons.dark) {
    tasks.push({
      kind: 'raster',
      type: 'logo',
      variant: 'light',
      name: 'assets/logo-light.png',
      source: resolved.logos.light,
      width: 1024,
      height: 1024,
      format: 'png',
      transparent: true
    });

    tasks.push({
      kind: 'raster',
      type: 'logo',
      variant: 'dark',
      name: 'assets/logo-dark.png',
      source: resolved.logos.dark,
      width: 1024,
      height: 1024,
      format: 'png',
      transparent: true
    });

    addVariantTasks(tasks, 'icons/light', 'light', resolved.logos.light, resolved.favicons.light, effective);
    addVariantTasks(tasks, 'icons/dark', 'dark', resolved.logos.dark, resolved.favicons.dark, effective);
  } else {
    addVariantTasks(tasks, 'icons/default', 'default', resolved.logos.default, resolved.favicons.default, effective);
  }

  if (effective.includeSocial) {
    tasks.push({
      kind: 'raster',
      type: 'social',
      variant: 'default',
      name: 'og-image.png',
      source: resolved.social.logo,
      width: 1200,
      height: 630,
      format: 'png',
      transparent: false
    });

    tasks.push({
      kind: 'raster',
      type: 'social',
      variant: 'default',
      name: 'twitter-image.png',
      source: resolved.social.logo,
      width: 1200,
      height: 600,
      format: 'png',
      transparent: false
    });
  }

  return tasks;
};
