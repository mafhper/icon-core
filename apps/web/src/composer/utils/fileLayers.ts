export interface FileLayerAsset {
  name: string;
  mimeType: string;
  data: string;
}

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

export const fileToLayerAsset = async (file: File): Promise<FileLayerAsset> => {
  if (!isSupportedLayerFile(file)) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const separator = dataUrl.indexOf(',');
  if (separator === -1) {
    throw new Error(`Invalid data URL for ${file.name}`);
  }

  return {
    name: file.name.replace(/\.[^.]+$/, '') || file.name,
    mimeType: inferMimeType(file),
    data: dataUrl.slice(separator + 1)
  };
};

export const sortLayerFiles = (files: File[]): File[] => {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};
