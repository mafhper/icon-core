

import { IconDefinition, ImageAnalysis, EditOptions } from '../types';

/**
 * Calculates the relative luminance of a color.
 * Formula from WCAG 2.0
 */
const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

/**
 * Extracts the dominant color from an image element.
 * Ignores transparent pixels.
 */
export const getDominantColor = (img: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#ffffff';
  
  // Resize to small size for faster processing
  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(img, 0, 0, 50, 50);
  
  const imageData = ctx.getImageData(0, 0, 50, 50).data;
  let r = 0, g = 0, b = 0, count = 0;
  
  for (let i = 0; i < imageData.length; i += 4) {
    // Only consider pixels with sufficient opacity
    if (imageData[i + 3] > 128) { 
      r += imageData[i];
      g += imageData[i + 1];
      b += imageData[i + 2];
      count++;
    }
  }
  
  if (count === 0) return '#ffffff';
  
  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);
  
  // Convert RGB to Hex
  const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return `#${hex}`;
};

/**
 * Analyzes the generated image data for contrast and visibility issues.
 */
export const analyzeImageVisibility = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  isTransparent: boolean,
  backgroundColorHex: string
): ImageAnalysis => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let totalLuminance = 0;
  let pixelCount = 0;
  
  // Parse background color for comparison
  const bgR = parseInt(backgroundColorHex.slice(1, 3), 16) || 255;
  const bgG = parseInt(backgroundColorHex.slice(3, 5), 16) || 255;
  const bgB = parseInt(backgroundColorHex.slice(5, 7), 16) || 255;
  const bgLuminance = getLuminance(bgR, bgG, bgB);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    // Only count pixels that have significant opacity
    if (a > 20) {
      totalLuminance += getLuminance(data[i], data[i + 1], data[i + 2]);
      pixelCount++;
    }
  }

  const suggestions: string[] = [];
  let contrastRatio = 0;

  if (pixelCount === 0) {
    suggestions.push("Image appears to be empty.");
  } else {
    const avgLuminance = totalLuminance / pixelCount;
    
    // Calculate Contrast Ratio (L1 + 0.05) / (L2 + 0.05)
    const L1 = Math.max(avgLuminance, bgLuminance);
    const L2 = Math.min(avgLuminance, bgLuminance);
    contrastRatio = (L1 + 0.05) / (L2 + 0.05);

    // WCAG AA for large text is 3:1, we use a similar baseline for icons
    if (contrastRatio < 1.5) {
      suggestions.push("Critical: Low contrast with background.");
    } else if (contrastRatio < 3) {
      suggestions.push("Warning: Contrast is below optimal levels.");
    }
  }

  // Check for transparency issues on "transparent" intended icons
  // If the icon is mostly dark, warn about dark mode. If mostly light, warn about light mode.
  if (isTransparent && pixelCount > 0) {
    const avgLuminance = totalLuminance / pixelCount;
    if (avgLuminance > 0.8) {
       suggestions.push("High brightness: May be invisible on light backgrounds.");
    } else if (avgLuminance < 0.2) {
       suggestions.push("Low brightness: May be invisible on dark backgrounds.");
    }
  }

  return {
    contrastRatio,
    isLowContrast: contrastRatio < 3 && contrastRatio > 0, // 0 usually means empty or transparent analysis
    hasTransparencyIssues: suggestions.length > 0,
    suggestions
  };
};

export const processImage = async (
  sourceFile: File, 
  config: IconDefinition, 
  backgroundColor: string = '#ffffff',
  options?: EditOptions
): Promise<{ blob: Blob, analysis: ImageAnalysis }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(sourceFile);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = config.width;
      canvas.height = config.height;

      // --- Background Handling ---
      // Determine if we should fill the background
      // Default: Fill if config says !transparent OR user set explicit background option
      // Override: If keepOriginalBackground is true, DO NOT fill (unless manual override forces it? No, keepOriginal takes precedence for the "default" fill)
      
      const userHasSetManualBg = !!options?.backgroundColor;
      const shouldKeepOriginal = options?.keepOriginalBackground;
      
      let finalBgColor = options?.backgroundColor || backgroundColor;
      
      // If the icon definition requires opacity (not transparent) OR user manually set a color
      // We fill. BUT if "Keep Original" is ON and user didn't manually override, we skip filling default brand color.
      let shouldFill = (!config.transparent || userHasSetManualBg);
      
      if (shouldKeepOriginal && !userHasSetManualBg) {
          shouldFill = false;
      }

      if (shouldFill) {
        ctx.fillStyle = finalBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // --- Drawing Logic with Transforms ---
      ctx.save();
      
      // Center the context
      ctx.translate(canvas.width / 2, canvas.height / 2);

      let scale = 1;
      
      // Calculate Base Scale based on logic type
      if (options?.scale !== undefined) {
         // User manual override (1 = 100% of canvas containment)
         // We need to determine "contain" ratio first
         const containScale = Math.min(canvas.width / img.width, canvas.height / img.height);
         scale = containScale * options.scale;
      } else {
        // Default Logic
        if (config.maskable) {
           // Maskable: shrink to approx 70% to be safe
           const padding = Math.floor(config.width * 0.15); // 15% each side = 30% total reduction roughly
           const safeWidth = config.width - (padding * 2);
           const safeHeight = config.height - (padding * 2);
           const scaleX = safeWidth / img.width;
           const scaleY = safeHeight / img.height;
           scale = Math.min(scaleX, scaleY);
        } else if (config.category === 'social') {
           // Cover logic for social (or contain, depending on preference. Contain is safer for logos)
           const scaleX = canvas.width / img.width;
           const scaleY = canvas.height / img.height;
           scale = Math.min(scaleX, scaleY);
        } else {
           // Standard Fit
           const scaleX = canvas.width / img.width;
           const scaleY = canvas.height / img.height;
           scale = Math.min(scaleX, scaleY);
        }
      }

      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      ctx.restore();

      // --- Analysis ---
      const analysis = analyzeImageVisibility(
        ctx, 
        canvas.width, 
        canvas.height, 
        !shouldFill, 
        finalBgColor
      );

      // --- Output ---
      const mimeType = config.format === 'jpg' ? 'image/jpeg' : 'image/png';
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve({ blob, analysis });
        } else {
          reject(new Error('Canvas to Blob failed'));
        }
      }, mimeType, 0.9);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};