import type { GenerationTask } from '@iconcore/engine';

const getLuminance = (r: number, g: number, b: number) => {
  const normalized = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return normalized[0] * 0.2126 + normalized[1] * 0.7152 + normalized[2] * 0.0722;
};

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

export const getDominantColor = (img: HTMLImageElement | HTMLCanvasElement) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#ffffff';

  canvas.width = 48;
  canvas.height = 48;
  ctx.drawImage(img, 0, 0, 48, 48);

  const data = ctx.getImageData(0, 0, 48, 48).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 140) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  if (count === 0) return '#ffffff';
  return toHex(Math.floor(r / count), Math.floor(g / count), Math.floor(b / count));
};

const loadImage = async (source: File | Blob): Promise<{ image: CanvasImageSource; width: number; height: number; cleanup: () => void }> => {
  try {
    const bitmap = await createImageBitmap(source);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(source);
      const image = new Image();
      image.onload = () => {
        resolve({
          image,
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
          cleanup: () => URL.revokeObjectURL(url)
        });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to decode image file.'));
      };
      image.src = url;
    });
  }
};

export interface ProcessResult {
  blob: Blob;
  contrastRatio: number;
}

export const processImage = async (
  source: File | Blob,
  task: GenerationTask<File | Blob>,
  options: {
    backgroundColor: string;
    socialBackground?: File | Blob | null;
    padding: number;
    darkBackgroundColor: string;
  }
): Promise<ProcessResult> => {
  const { image, width, height, cleanup } = await loadImage(source);

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas context unavailable');

    canvas.width = task.width ?? 1024;
    canvas.height = task.height ?? 1024;

    if (task.type === 'social' && options.socialBackground) {
      const social = await loadImage(options.socialBackground);
      try {
        const scale = Math.max(canvas.width / social.width, canvas.height / social.height);
        const drawW = social.width * scale;
        const drawH = social.height * scale;
        ctx.drawImage(social.image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
      } finally {
        social.cleanup();
      }
    } else if (!task.transparent) {
      const background = task.variant === 'dark' ? options.darkBackgroundColor : options.backgroundColor;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const margin = Math.max(0, Math.min(0.45, options.padding));
    const baseScale = Math.min(canvas.width / width, canvas.height / height);
    const finalScale = baseScale * (1 - margin * 2);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(finalScale, finalScale);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let foregroundLuminance = 0;
    let visiblePixels = 0;

    for (let i = 0; i < pixels.length; i += 80) {
      if (pixels[i + 3] > 20) {
        foregroundLuminance += getLuminance(pixels[i], pixels[i + 1], pixels[i + 2]);
        visiblePixels += 1;
      }
    }

    const fg = visiblePixels > 0 ? foregroundLuminance / visiblePixels : 1;
    const bg = task.transparent ? 1 : getLuminance(16, 16, 16);
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);

    const mimeType = task.format === 'jpg' ? 'image/jpeg' : 'image/png';

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error('Canvas export failed.'));
        },
        mimeType,
        0.95
      );
    });

    return { blob, contrastRatio: ratio };
  } finally {
    cleanup();
  }
};
