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
 * Convert an SVG length (`24`, `24px`, `2.5cm`) to CSS px. Returns `null` for
 * percentages and relative units, which have no intrinsic size.
 */
const CSS_PX_PER_UNIT: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  q: 96 / 101.6
};

const parseSvgLength = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const text = raw.trim();
  if (text === '' || text.endsWith('%')) return null;
  const match = /^([0-9]*\.?[0-9]+)([a-z]*)$/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  const perUnit = CSS_PX_PER_UNIT[(match[2] || 'px').toLowerCase()];
  if (!Number.isFinite(value) || value <= 0 || perUnit === undefined) return null;
  return value * perUnit;
};

const parseViewBoxSize = (tag: string): { width: number; height: number } | null => {
  const match = /viewBox\s*=\s*["']([^"']*)["']/i.exec(tag);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

/**
 * Intrinsic size of an SVG document, in CSS px.
 *
 * Reads the **root `<svg>` tag only** — a nested `<rect width="2">` must not
 * win. Declared `width`/`height` take precedence; when only one is present the
 * `viewBox` ratio derives the other; with neither, the `viewBox` size is used.
 * Returns `null` when the document declares no usable intrinsic size (e.g.
 * `width="100%"`), so the caller can fall back to rasterising.
 *
 * This is what keeps imports from squishing: `layerBaseRect` sizes the layer
 * from this ratio and the Canvas2D backend stretches the source into that
 * rectangle, so a square guess distorts every non-square asset.
 */
export const parseSvgIntrinsicSize = (svgText: string): { width: number; height: number } | null => {
  const tag = /<svg\b[^>]*>/i.exec(svgText)?.[0];
  if (!tag) return null;

  const viewBox = parseViewBoxSize(tag);
  let width = parseSvgLength(/\bwidth\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]);
  let height = parseSvgLength(/\bheight\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]);

  if (viewBox) {
    if (width != null && height == null) height = (width * viewBox.height) / viewBox.width;
    else if (height != null && width == null) width = (height * viewBox.width) / viewBox.height;
    else if (width == null && height == null) {
      width = viewBox.width;
      height = viewBox.height;
    }
  }

  if (width == null || height == null) return null;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
};

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
