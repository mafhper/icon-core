/**
 * ICO writer — bundles PNGs (RGBA) into a Windows `.ico`.
 *
 * Recovered from the legacy editor (`apps/web/src/lib/icoGenerator.ts`, commit
 * 038e09e~1) and normalised to the EX2 encoder contract: entries are squares
 * described by their physical size, directories carry PNG blobs, and sizes
 * >= 256 are encoded with the 0-byte convention Windows uses for "larger than
 * 255px".
 */
export const encodeIco = async (entries: { width: number; blob: Blob }[]): Promise<Blob> => {
  const count = entries.length;
  if (count < 1 || count > 255) {
    throw new Error(`ICO requires between 1 and 255 entries (got ${count}).`);
  }

  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon (1)
  view.setUint16(4, count, true);

  const directories: Uint8Array[] = [];
  const imageBuffers: ArrayBuffer[] = [];
  let currentOffset = 6 + count * 16;

  for (const entry of entries) {
    const buffer = await entry.blob.arrayBuffer();
    imageBuffers.push(buffer);

    const dir = new Uint8Array(16);
    const dirView = new DataView(dir.buffer);
    dirView.setUint8(0, entry.width >= 256 ? 0 : entry.width);
    dirView.setUint8(1, entry.width >= 256 ? 0 : entry.width);
    dirView.setUint8(2, 0); // palette entries (unused for 32-bit)
    dirView.setUint8(3, 0); // reserved
    dirView.setUint16(4, 1, true); // color planes
    dirView.setUint16(6, 32, true); // bits per pixel
    dirView.setUint32(8, buffer.byteLength, true);
    dirView.setUint32(12, currentOffset, true);

    directories.push(dir);
    currentOffset += buffer.byteLength;
  }

  return new Blob([header, ...directories, ...imageBuffers] as unknown as BlobPart[], {
    type: 'image/x-icon'
  });
};