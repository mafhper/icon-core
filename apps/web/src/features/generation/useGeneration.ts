import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGenerationPlan,
  buildOutputMap,
  generateManifest,
  resolveSources,
  type GenerationTask,
  type IconManifest,
  type OutputEntry,
  type ResolvedSources
} from '@iconcore/engine';
import type { OutputMode, ProjectConfig } from '@iconcore/shared';
import { processImage } from '../../lib/imageProcessor';
import { generateIco } from '../../lib/icoGenerator';
import type { AppPreferences, GeneratedArtifact, GeneratorSettings, UploadState } from '../../types';

interface UseGenerationState {
  isGenerating: boolean;
  error: string | null;
  artifacts: GeneratedArtifact[];
  manifest: IconManifest | null;
  outputMap: OutputEntry[];
  mode: OutputMode | null;
}

interface GenerateInput {
  uploads: UploadState;
  projectConfig: ProjectConfig;
  settings: GeneratorSettings;
  preferences: AppPreferences;
}

const isSvgFile = (source: File | Blob) => source.type === 'image/svg+xml';

const toArtifact = (
  source: Blob,
  name: string,
  type: 'logo' | 'favicon' | 'social',
  variant: 'default' | 'light' | 'dark',
  width = 0,
  height = 0
): GeneratedArtifact => ({
  id: `${name}-${crypto.randomUUID()}`,
  name,
  blob: source,
  url: URL.createObjectURL(source),
  size: source.size,
  width,
  height,
  variant,
  type
});

const forceOutputMode = (
  resolved: ResolvedSources<File | Blob>,
  requested: AppPreferences['outputMode']
): ResolvedSources<File | Blob> => {
  if (requested === 'auto') return resolved;

  if (requested === 'default') {
    return {
      mode: 'default',
      logos: { default: resolved.logos.default },
      favicons: { default: resolved.favicons.default },
      social: resolved.social
    };
  }

  const hasThemedAssets =
    Boolean(resolved.logos.light) &&
    Boolean(resolved.logos.dark) &&
    Boolean(resolved.favicons.light) &&
    Boolean(resolved.favicons.dark);

  if (!hasThemedAssets) {
    throw new Error('Themed output requires light and dark logo + favicon uploads.');
  }

  return {
    mode: 'themed',
    logos: {
      default: resolved.logos.default,
      light: resolved.logos.light,
      dark: resolved.logos.dark
    },
    favicons: {
      default: resolved.favicons.default,
      light: resolved.favicons.light,
      dark: resolved.favicons.dark
    },
    social: resolved.social
  };
};

export const useGeneration = () => {
  const [state, setState] = useState<UseGenerationState>({
    isGenerating: false,
    error: null,
    artifacts: [],
    manifest: null,
    outputMap: [],
    mode: null
  });

  const artifactUrls = useRef<string[]>([]);

  const clearPreviousUrls = useCallback(() => {
    for (const url of artifactUrls.current) {
      URL.revokeObjectURL(url);
    }
    artifactUrls.current = [];
  }, []);

  useEffect(() => {
    return () => clearPreviousUrls();
  }, [clearPreviousUrls]);

  const generate = useCallback(
    async ({ uploads, projectConfig, settings, preferences }: GenerateInput) => {
      const master = uploads.master.file;
      if (!master) {
        setState((previous) => ({ ...previous, error: 'Master asset is required.' }));
        return;
      }

      setState((previous) => ({ ...previous, isGenerating: true, error: null }));

      try {
        const resolvedAuto = resolveSources({
          master,
          light: uploads.light.file ?? undefined,
          dark: uploads.dark.file ?? undefined,
          favicon: uploads.favicon.file ?? undefined,
          faviconLight: uploads.faviconLight.file ?? undefined,
          faviconDark: uploads.faviconDark.file ?? undefined,
          socialBackground: uploads.socialBackground.file ?? undefined
        });

        const resolved = forceOutputMode(resolvedAuto, preferences.outputMode);

        const baseTasks = buildGenerationPlan(resolved, {
          includeSocial: settings.includeSocial,
          includeFaviconSvg: preferences.includeFaviconSvg,
          opaqueBackground: !settings.transparentBackground
        });

        const tasks: Array<GenerationTask<File | Blob>> = baseTasks.filter((task) => {
          if (!preferences.includeIco && task.kind === 'ico') return false;
          if (!preferences.includeLogoSvg && task.kind === 'passthrough' && task.name === 'assets/logo.svg') {
            return false;
          }
          return true;
        });

        const artifacts: GeneratedArtifact[] = [];
        const socialBackground = uploads.socialBackground.file;
        const getPaddingByType = (type: 'logo' | 'favicon' | 'social') => {
          if (type === 'favicon') return settings.faviconPadding;
          if (type === 'social') return settings.socialPadding;
          return settings.logoPadding;
        };

        for (const task of tasks) {
          const source = task.source;

          if (task.kind === 'passthrough') {
            if (task.format === 'svg' && isSvgFile(source)) {
              artifacts.push(toArtifact(source, task.name, task.type, task.variant));
            }
            continue;
          }

          if (task.kind === 'ico') {
            const png16 = await processImage(source, {
              ...task,
              kind: 'raster',
              width: 16,
              height: 16,
              format: 'png',
              transparent: true,
              type: 'favicon'
            }, {
              backgroundColor: settings.backgroundColor,
              darkBackgroundColor: settings.darkBackgroundColor,
              socialBackground,
              padding: settings.faviconPadding
            });

            const png32 = await processImage(source, {
              ...task,
              kind: 'raster',
              width: 32,
              height: 32,
              format: 'png',
              transparent: true,
              type: 'favicon'
            }, {
              backgroundColor: settings.backgroundColor,
              darkBackgroundColor: settings.darkBackgroundColor,
              socialBackground,
              padding: settings.faviconPadding
            });

            const blob = await generateIco([
              { width: 16, height: 16, blob: png16.blob },
              { width: 32, height: 32, blob: png32.blob }
            ]);

            artifacts.push(toArtifact(blob, task.name, 'favicon', task.variant, 32, 32));
            continue;
          }

          const raster = await processImage(source, task, {
            backgroundColor: settings.backgroundColor,
            darkBackgroundColor: settings.darkBackgroundColor,
            socialBackground,
            padding: getPaddingByType(task.type)
          });

          artifacts.push(
            toArtifact(
              raster.blob,
              task.name,
              task.type,
              task.variant,
              task.width ?? 0,
              task.height ?? 0
            )
          );
        }

        const manifest = generateManifest({
          project: projectConfig,
          mode: resolved.mode,
          defaultTheme: projectConfig.defaultTheme,
          themeColor: settings.backgroundColor,
          backgroundColor: settings.backgroundColor
        });

        clearPreviousUrls();
        artifactUrls.current = artifacts.map((artifact) => artifact.url);

        setState({
          isGenerating: false,
          error: null,
          artifacts,
          manifest,
          outputMap: buildOutputMap(tasks),
          mode: resolved.mode
        });
      } catch (error) {
        setState((previous) => ({
          ...previous,
          isGenerating: false,
          error: error instanceof Error ? error.message : 'Generation failed.'
        }));
      }
    },
    [clearPreviousUrls]
  );

  return useMemo(
    () => ({
      ...state,
      generate
    }),
    [state, generate]
  );
};
