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

/**
 * Intrinsic (untransformed) pixel size of a stored layer payload.
 *
 * Single source of truth shared by the importer and by the "Reset aspect"
 * action (IC3 §4.2, option C). If these two ever measure differently the
 * squish bug comes back, so both must go through this.
 *
 * - SVG: parsed synchronously via the shared `parseSvgIntrinsicSize` — the
 *   same helper the SVG exporter uses, so no timing dependency.
 * - Raster: decoded with `createImageBitmap` (asynchronous, fine for an
 *   explicit user action).
 * - Nothing measurable → `null`, so callers decide. The importer falls back
 *   to {@link FALLBACK_SIZE}; the action reports "cannot measure".
 */
export const measureIntrinsicSize = async (
  mimeType: string | undefined,
  data: string
): Promise<{ width: number; height: number } | null> => {
  if (mimeType === 'image/svg+xml') {
    const parsed = parseSvgIntrinsicSize(decodeStoredPayload(data));
    if (parsed) return parsed;
  }

  if (!mimeType || !data) return null;

  try {
    const bitmap = await createImageBitmap(payloadToFile(mimeType, data));
    return { width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
};

/**
 * Decode a stored payload (`source.data`) back to text/bytes. `readAsDataURL`
 * produces base64; some producers emit the percent-encoded form instead.
 */
const decodeStoredPayload = (data: string): string => {
  if (/%[0-9a-f]{2}/i.test(data)) {
    try {
      return decodeURIComponent(data);
    } catch {
      return data;
    }
  }
  return atobSafe(data);
};

const atobSafe = (value: string): string => {
  try {
    return atob(value);
  } catch {
    return '';
  }
};

const payloadToFile = (mimeType: string, data: string): File => {
  const bytes = Uint8Array.from(atobSafe(data), (char) => char.charCodeAt(0));
  return new File([bytes], 'layer', { type: mimeType });
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
