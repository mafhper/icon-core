import { hexToRgb, rgbToHex } from './color';

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawToCanvas = (img: HTMLImageElement): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, 0, 0);
  return { ctx, canvas };
};

/** Sample the border pixels and return the most common (quantized) color as hex. */
export const detectBorderColor = async (src: string): Promise<string> => {
  const img = await loadImageElement(src);
  const { ctx, canvas } = drawToCanvas(img);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const counts = new Map<string, { count: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 10) return;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const entry = counts.get(key) ?? { count: 0, r, g, b };
    entry.count += 1;
    counts.set(key, entry);
  };

  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best ? rgbToHex(best) : '#000000';
};

const MAX_DIST = Math.sqrt(3 * 255 * 255);

/**
 * Make pixels within `tolerancePct` of `targetHex` transparent.
 * Returns a PNG data URL.
 */
export const removeBackground = async (src: string, targetHex: string, tolerancePct: number): Promise<string> => {
  const img = await loadImageElement(src);
  const { ctx, canvas } = drawToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const target = hexToRgb(targetHex) ?? { r: 0, g: 0, b: 0 };
  const tol = (tolerancePct / 100) * MAX_DIST;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const dist = Math.sqrt((d[i] - target.r) ** 2 + (d[i + 1] - target.g) ** 2 + (d[i + 2] - target.b) ** 2);
    if (dist <= tol) d[i + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

/** Strip the `data:...;base64,` prefix, returning just the base64 payload. */
export const dataUrlToBase64 = (dataUrl: string): string => dataUrl.replace(/^data:[^;]+;base64,/, '');
