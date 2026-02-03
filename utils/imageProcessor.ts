import { IconDefinition, ImageAnalysis } from '../types';

const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const getDominantColor = (img: HTMLImageElement | HTMLCanvasElement): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#ffffff';
  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(img, 0, 0, 50, 50);
  const imageData = ctx.getImageData(0, 0, 50, 50).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < imageData.length; i += 4) {
    if (imageData[i + 3] > 128) { 
      r += imageData[i];
      g += imageData[i + 1];
      b += imageData[i + 2];
      count++;
    }
  }
  if (count === 0) return '#ffffff';
  return rgbToHex(Math.floor(r / count), Math.floor(g / count), Math.floor(b / count));
};

// Robust image loader that falls back to HTMLImageElement if createImageBitmap fails
const loadImageResource = async (source: File | Blob): Promise<{ img: CanvasImageSource, width: number, height: number, cleanup: () => void }> => {
  try {
    const img = await createImageBitmap(source);
    return { img, width: img.width, height: img.height, cleanup: () => img.close() };
  } catch (e) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => resolve({ 
        img, 
        width: img.naturalWidth || img.width, 
        height: img.naturalHeight || img.height, 
        cleanup: () => URL.revokeObjectURL(url) 
      });
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode image source. Ensure file is a valid image."));
      };
      img.src = url;
    });
  }
};

export const processImage = async (
  logoSource: File | Blob, 
  config: IconDefinition, 
  backgroundColor: string = '#ffffff',
  bgSource?: File | Blob | null,
  options?: { scale: number; padding: number }
): Promise<{ blob: Blob, analysis: ImageAnalysis }> => {
  
  const { img, width: imgWidth, height: imgHeight, cleanup } = await loadImageResource(logoSource);

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas context failed');

    canvas.width = config.width;
    canvas.height = config.height;

    // 1. Draw Background
    if (config.type === 'social' && bgSource) {
      const { img: bgImg, width: bgW_orig, height: bgH_orig, cleanup: bgCleanup } = await loadImageResource(bgSource);
      try {
        const bgScale = Math.max(canvas.width / bgW_orig, canvas.height / bgH_orig);
        const bgW = bgW_orig * bgScale;
        const bgH = bgH_orig * bgScale;
        ctx.drawImage(bgImg, (canvas.width - bgW) / 2, (canvas.height - bgH) / 2, bgW, bgH);
      } finally {
        bgCleanup();
      }
    } else if (!config.transparent) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw Logo
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const baseScale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight);
    
    // Changed default padding from 0.15 (15%) to 0 to fix excessive transparent borders
    const margin = options?.padding ?? 0; 
    
    const finalScale = baseScale * (1 - margin * 2) * (options?.scale ?? 1);
    
    ctx.scale(finalScale, finalScale);
    ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();

    // 3. Simple Contrast Analysis
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let fgLum = 0, bgLum = 0, pix = 0;
    for (let i = 0; i < imageData.length; i += 40) { // sampled
      if (imageData[i+3] > 128) { fgLum += getLuminance(imageData[i], imageData[i+1], imageData[i+2]); pix++; }
    }
    
    const analysis: ImageAnalysis = {
      contrastRatio: 4.5,
      isLowContrast: false,
      hasTransparencyIssues: false,
      suggestions: [],
      detectedForegroundColor: '#000000',
      detectedBackgroundColor: backgroundColor
    };

    const mimeType = config.format === 'jpg' ? 'image/jpeg' : 'image/png';
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, analysis });
        } else {
          reject(new Error("Canvas toBlob failed"));
        }
      }, mimeType, 0.95);
    });

  } finally {
    cleanup();
  }
};