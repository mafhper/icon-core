/**
 * Generates an ICO file buffer from an array of PNG images.
 * This constructs the binary header and directory entries for the ICO format.
 */
export const generateIco = async (images: { width: number; height: number; blob: Blob }[]): Promise<Blob> => {
  const HEADER_SIZE = 6;
  const DIRECTORY_ENTRY_SIZE = 16;
  
  const numImages = images.length;
  const directorySize = numImages * DIRECTORY_ENTRY_SIZE;
  const offsetBase = HEADER_SIZE + directorySize;
  
  let currentOffset = offsetBase;
  
  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);
  
  view.setUint16(0, 0, true); // Reserved (0)
  view.setUint16(2, 1, true); // Type (1 for ICO)
  view.setUint16(4, numImages, true); // Number of images
  
  const directories: Uint8Array[] = [];
  const imageBuffers: ArrayBuffer[] = [];
  
  for (const img of images) {
    const buffer = await img.blob.arrayBuffer();
    imageBuffers.push(buffer);
    
    const dir = new Uint8Array(16);
    const dirView = new DataView(dir.buffer);
    
    const w = img.width >= 256 ? 0 : img.width;
    const h = img.height >= 256 ? 0 : img.height;
    
    dirView.setUint8(0, w); // Width
    dirView.setUint8(1, h); // Height
    dirView.setUint8(2, 0); // Palette count (0 = no palette)
    dirView.setUint8(3, 0); // Reserved
    dirView.setUint16(4, 1, true); // Color planes (1)
    dirView.setUint16(6, 32, true); // Bits per pixel (32)
    dirView.setUint32(8, buffer.byteLength, true); // Size of image data
    dirView.setUint32(12, currentOffset, true); // Offset of image data
    
    directories.push(dir);
    currentOffset += buffer.byteLength;
  }
  
  // Combine all parts
  const finalBlobParts = [header, ...directories, ...imageBuffers];
  return new Blob(finalBlobParts, { type: 'image/x-icon' });
};