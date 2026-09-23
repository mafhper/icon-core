import type {
  ExportArtifact,
  ExportArtifactSpec,
  ExportContainerSpec,
  IconCoreProject,
  IconVariant
} from '@iconcore/shared';
import { kindOf } from '@iconcore/shared';
import type { RenderBackend } from '@iconcore/renderer';
import { renderProject } from '@iconcore/renderer';
import type { EncoderOutput } from './types';
import type { RasterFormat } from './raster';
import { encodeRaster } from './raster';
import type { SvgEncodeOptions } from './svg';
import { encodeSvg } from './svg';
import { encodeIco } from './ico';
import { encodeIcns } from './icns';

export { encodeRaster } from './raster';
export type { RasterFormat } from './raster';
export { encodeSvg } from './svg';
export type { SvgEncodeOptions } from './svg';
export { encodeIco } from './ico';
export { encodeIcns } from './icns';
export type { EncoderInput, EncoderOutput } from './types';

export interface EncodeOptions {
  svg?: SvgEncodeOptions;
}

/**
 * EX2 encoder facade — renders a single artifact to a `Blob`, dispatching by
 * format nature (raster / vector / container, ADR-014 §1.2).
 *
 * Usage: `const { blob, warnings } = await encodeArtifact(artifact, project, variant, backend);`
 */
export const encodeArtifact = async (
  artifact: ExportArtifact,
  project: IconCoreProject,
  variant: IconVariant,
  backend: RenderBackend,
  options: EncodeOptions = {}
): Promise<EncoderOutput> => {
  switch (kindOf(artifact.format)) {
    case 'raster':
      return encodeRaster(
        artifact as ExportArtifactSpec & { format: RasterFormat },
        project,
        variant,
        backend
      );
    case 'vector':
      return encodeSvg(project, variant, backend, options.svg);
    case 'container':
      return encodeContainer(artifact as ExportContainerSpec, project, variant, backend);
    default:
      throw new Error(`Unhandled artifact format: ${(artifact as ExportArtifact).format}`);
  }
};

const encodeContainer = async (
  artifact: ExportContainerSpec,
  project: IconCoreProject,
  variant: IconVariant,
  backend: RenderBackend
): Promise<EncoderOutput> => {
  const warnings: string[] = [];

  if (artifact.entries.length === 0) {
    throw new Error(`${artifact.format.toUpperCase()} artifact "${artifact.path}" has no entries.`);
  }

  const representations: { width: number; blob: Blob }[] = [];
  for (const width of artifact.entries) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new Error(`Invalid ${artifact.format.toUpperCase()} entry size: ${width}.`);
    }
    const blob = await renderProject(project, variant, width, backend, { format: 'png' });
    representations.push({ width, blob });
  }

  const blob =
    artifact.format === 'ico' ? await encodeIco(representations) : await encodeIcns(representations);
  return { blob, warnings };
};