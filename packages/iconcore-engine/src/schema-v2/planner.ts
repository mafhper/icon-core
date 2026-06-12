import type { IconTarget, IconVariant, Fill } from '@iconcore/shared';
import type { IconCoreProject } from '@iconcore/shared';
import { TARGET_REGISTRY } from './targets';
import type { TargetDefinition } from './targets';

export interface RasterTask {
  size: number;
  format: 'png' | 'ico' | 'icns' | 'svg' | 'webp';
  outputPath: string;
  maskable: boolean;
  transparent: boolean;
}

export interface ManifestEntry {
  path: string;
  generator: 'manifest' | 'browserconfig';
}

export interface TargetPlan {
  target: IconTarget;
  variant: IconVariant;
  tasks: RasterTask[];
  manifestFiles: ManifestEntry[];
  warnings: string[];
}

const resolveBackground = (project: IconCoreProject, variant: IconVariant): Fill => {
  const overridden = project.variants[variant]?.canvas?.background;
  if (overridden) return overridden;
  return project.canvas.background;
};

const resolveTransparent = (target: TargetDefinition, variant: IconVariant): boolean => {
  if (target.id === 'marketing') return true;
  if (variant === 'transparent') return true;
  if (target.id === 'web-favicon' || target.id === 'pwa') return false;
  return true;
};

const buildFileName = (
  target: TargetDefinition,
  size: number,
  format: string,
  maskable: boolean
): string => {
  const dir = target.iconSubDir ? `${target.iconSubDir}/` : '';
  const sizeSuffix = `${size}x${size}`;

  if (target.id === 'web-favicon') {
    if (format === 'ico') return 'favicon.ico';
    if (format === 'svg') return 'favicon.svg';
    if (size === 180) return `${dir}apple-touch-icon.png`;
    if (size === 152) return `${dir}apple-touch-icon-152x152.png`;
    if (size === 120) return `${dir}apple-touch-icon-120x120.png`;
    return `${dir}favicon-${sizeSuffix}.png`;
  }

  if (target.id === 'pwa') {
    const prefix = maskable ? 'icon-maskable-' : 'icon-';
    return `${dir}${prefix}${sizeSuffix}.png`;
  }

  if (target.id === 'tauri') {
    if (size === 512) return `${dir}icon.png`;
    if (size === 256) return `${dir}128x128@2x.png`;
    return `${dir}${size}x${size}.png`;
  }

  if (target.id === 'electron') {
    if (format === 'ico') return `build/icon.ico`;
    if (format === 'icns') return `build/icon.icns`;
    if (size === 512) return `build/icon.png`;
    return `build/icons/${size}x${size}.png`;
  }

  if (target.id === 'desktop-generic') {
    if (format === 'ico') return `windows/icon.ico`;
    if (format === 'icns') return `macos/icon.icns`;
    return `linux/${size}x${size}.png`;
  }

  if (target.id === 'marketing') {
    if (size === 1200) return `marketing/open-graph.png`;
    return `marketing/icon-${size}.png`;
  }

  return `${dir}icon-${sizeSuffix}.${format}`;
};

export const buildTargetPlan = (
  project: IconCoreProject,
  targetId: IconTarget,
  variant: IconVariant = 'default'
): TargetPlan => {
  const target = TARGET_REGISTRY[targetId];
  const tasks: RasterTask[] = [];
  const warnings: string[] = [];

  const projectTargetConfig = project.targets.find(t => t.target === targetId);

  const sizes = projectTargetConfig?.sizes ?? target.defaultSizes;
  const formats = projectTargetConfig?.formats ?? target.defaultFormats;
  const includeMaskable = projectTargetConfig?.includeMaskable ?? target.includeMaskable;

  for (const size of sizes) {
    for (const format of formats) {
      const transparent = resolveTransparent(target, variant);

      if (format === 'ico') {
        const icoSizes = target.id === 'web-favicon' ? [16, 32] : (target.id === 'tauri' ? [32] : [16, 32, 48]);
        const hasIco = tasks.some(t => t.format === 'ico');
        if (!hasIco) {
          for (const icoSize of icoSizes) {
            if (sizes.includes(icoSize) || icoSizes.includes(icoSize)) {
              tasks.push({
                size: icoSize,
                format: 'png',
                outputPath: buildFileName(target, icoSize, 'png', false),
                maskable: false,
                transparent: true
              });
            }
          }
          tasks.push({
            size: icoSizes[icoSizes.length - 1],
            format: 'ico',
            outputPath: buildFileName(target, 0, 'ico', false),
            maskable: false,
            transparent: false
          });
        }
        continue;
      }

      if (format === 'icns') {
        tasks.push({
          size: sizes.includes(512) ? 512 : sizes[sizes.length - 1],
          format: 'icns',
          outputPath: buildFileName(target, 0, 'icns', false),
          maskable: false,
          transparent: false
        });
        continue;
      }

      if (format === 'svg' && target.id === 'web-favicon') {
        tasks.push({
          size,
          format: 'svg',
          outputPath: buildFileName(target, size, 'svg', false),
          maskable: false,
          transparent: true
        });
        continue;
      }

      tasks.push({
        size,
        format: format as RasterTask['format'],
        outputPath: buildFileName(target, size, format, false),
        maskable: false,
        transparent
      });

      if (includeMaskable && (size === 192 || size === 512)) {
        tasks.push({
          size,
          format: 'png',
          outputPath: buildFileName(target, size, 'png', true),
          maskable: true,
          transparent: false
        });
      }
    }
  }

  const manifestFiles: ManifestEntry[] = [];
  if (target.includeManifest && target.manifestFileName) {
    manifestFiles.push({
      path: target.manifestFileName,
      generator: 'manifest'
    });
  }

  for (const extra of target.extraFiles) {
    if (extra.generator !== 'none') {
      manifestFiles.push({
        path: extra.name,
        generator: extra.generator as 'manifest' | 'browserconfig'
      });
    }
  }

  if (target.id === 'marketing') {
    const has1024 = sizes.includes(1024);
    const has512 = sizes.includes(512);
    if (!has1024) {
      warnings.push('Marketing target typically includes 1024px size');
    }
  }

  return {
    target: targetId,
    variant,
    tasks,
    manifestFiles,
    warnings
  };
};