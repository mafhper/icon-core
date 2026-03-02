export const generateIco = async (images: { width: number; height: number; blob: Blob }[]): Promise<Blob> => {
  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  const directories: Uint8Array[] = [];
  const imageBuffers: ArrayBuffer[] = [];
  let currentOffset = 6 + images.length * 16;

  for (const img of images) {
    const buffer = await img.blob.arrayBuffer();
    imageBuffers.push(buffer);

    const dir = new Uint8Array(16);
    const dirView = new DataView(dir.buffer);

    dirView.setUint8(0, img.width >= 256 ? 0 : img.width);
    dirView.setUint8(1, img.height >= 256 ? 0 : img.height);
    dirView.setUint8(2, 0);
    dirView.setUint8(3, 0);
    dirView.setUint16(4, 1, true);
    dirView.setUint16(6, 32, true);
    dirView.setUint32(8, buffer.byteLength, true);
    dirView.setUint32(12, currentOffset, true);

    directories.push(dir);
    currentOffset += buffer.byteLength;
  }

  const blobParts: BlobPart[] = [
    header as unknown as BlobPart,
    ...directories.map((directory) => directory as unknown as BlobPart),
    ...imageBuffers.map((buffer) => buffer as BlobPart)
  ];

  return new Blob(blobParts, { type: 'image/x-icon' });
};
