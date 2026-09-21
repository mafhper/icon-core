import { parseSvgIntrinsicSize } from '@iconcore/renderer';

export interface FileLayerAsset {
  name: string;
  mimeType: string;
  data: string;
  width: number;
  height: number;
}

/** Used only when nothing can measure the asset (last resort, keeps the old behaviour). */
const FALLBACK_SIZE = 512;

const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp'
]);

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp']);

export const isSupportedLayerFile = (file: File): boolean => {
  if (SUPPORTED_MIME_TYPES.has(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return [...SUPPORTED_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
};

const inferMimeType = (file: File): string => {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.svg')) return 'image/svg+xml';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error(`Could not read ${file.name} as data URL.`));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
};

/**
 * SVG documents are measured by the shared `parseSvgIntrinsicSize`
 * (`@iconcore/renderer`), the same helper the SVG exporter uses to place an
 * inline SVG — the two must agree or PNG and SVG would size it differently.
 */

/** Decode the text payload of an `image/svg+xml` data URL (base64 or percent-encoded). */
const decodeSvgDataUrl = (dataUrl: string): string => {
  const separator = dataUrl.indexOf(',');
  if (separator === -1) return '';
  const meta = dataUrl.slice(0, separator);
  const payload = dataUrl.slice(separator + 1);
  if (!/;base64/i.test(meta)) {
    try {
      return decodeURIComponent(payload);
    } catch {
      return payload;
    }
  }
  try {
    return atob(payload);
  } catch {
    return '';
  }
};

const isSvgFile = (file: File): boolean =>
  file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

/**
 * Dimensions of the imported asset: SVGs are measured by parsing the document
 * (deterministic, no timing dependency), rasters by decoding them. An SVG that
 * declares no intrinsic size falls back to the browser's own rasterisation —
 * never to a square guess.
 */
const measureAssetSize = async (file: File, dataUrl: string): Promise<{ width: number; height: number }> => {
  if (isSvgFile(file)) {
    const parsed = parseSvgIntrinsicSize(decodeSvgDataUrl(dataUrl));
    if (parsed) return parsed;
  }

  try {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height };
  } catch {
    return { width: FALLBACK_SIZE, height: FALLBACK_SIZE };
  }
};

export const fileToLayerAsset = async (file: File): Promise<FileLayerAsset> => {
  if (!isSupportedLayerFile(file)) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  // Read once: the data URL is both the payload and the source for SVG measuring.
  const dataUrl = await readFileAsDataUrl(file);
  const separator = dataUrl.indexOf(',');
  if (separator === -1) {
    throw new Error(`Invalid data URL for ${file.name}`);
  }

  const dimensions = await measureAssetSize(file, dataUrl);

  return {
    name: file.name.replace(/\.[^.]+$/, '') || file.name,
    mimeType: inferMimeType(file),
    data: dataUrl.slice(separator + 1),
    width: dimensions.width,
    height: dimensions.height
  };
};

export const sortLayerFiles = (files: File[]): File[] => {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};
