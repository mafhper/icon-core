import type { IconManifest, OutputEntry } from '@iconcore/engine';
import type { AppPreferences, GeneratedArtifact } from '../../types';

interface LayoutOptions {
  outputStructure: AppPreferences['outputStructure'];
}

const flattenPath = (path: string): string => {
  const clean = path.replace(/\\/g, '/');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? clean;

  const file = parts[parts.length - 1];
  if (parts[0] === 'icons' && parts.length >= 3) {
    const variant = parts[1];
    if (variant === 'default') return file;
    return `${variant}-${file}`;
  }

  return `${parts.slice(0, -1).join('-')}-${file}`;
};

const applyStructure = (path: string, structure: LayoutOptions['outputStructure']) => {
  if (structure === 'flat') return flattenPath(path);
  return path.replace(/\\/g, '/');
};

export const remapOutputPath = (path: string, options: LayoutOptions) => {
  const structured = applyStructure(path, options.outputStructure);
  return structured;
};

export const remapManifestForLayout = (
  manifest: IconManifest,
  options: Pick<LayoutOptions, 'outputStructure'>
): IconManifest => {
  if (options.outputStructure === 'standard') return manifest;

  return {
    ...manifest,
    icons: manifest.icons.map((icon) => ({
      ...icon,
      src: applyStructure(icon.src, options.outputStructure)
    }))
  };
};

export const remapArtifactsForExport = (
  artifacts: GeneratedArtifact[],
  options: LayoutOptions
): Array<{ path: string; blob: Blob }> =>
  artifacts.map((artifact) => ({
    path: remapOutputPath(artifact.name, options),
    blob: artifact.blob
  }));

export const remapOutputMapForLayout = (entries: OutputEntry[], options: LayoutOptions): OutputEntry[] =>
  entries.map((entry) => {
    const path = remapOutputPath(entry.path, options);
    const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
    return {
      ...entry,
      path,
      directory
    };
  });
