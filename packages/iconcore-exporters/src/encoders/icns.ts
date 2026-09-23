import { EXPORT_FORMAT_MIME } from '@iconcore/shared';

/**
 * ICNS writer — bundles PNGs into an Apple `.icns`.
 *
 * Apple's modern icon types are PNG blobs selected by an OSType. The mapping
 * below is the canonical physical-size table (icp4..ic10); entries are physical
 * pixel sizes, so @2x logical variants (ic11..ic14) collapse onto their physical
 * representation (ADR-014 §1.4).
 *
 * Layout: 8-byte file header (`icns` + big-endian total length), then per
 * representation: 4-byte OSType, big-endian length (data + 8), data bytes.
 */
const ICNS_TYPE_BY_SIZE: Record<number, string> = {
  16: 'icp4',
  32: 'icp5',
  64: 'icp6',
  128: 'ic07',
  256: 'ic08',
  512: 'ic09',
  1024: 'ic10'
};

const isSupportedSize = (width: number): width is keyof typeof ICNS_TYPE_BY_SIZE =>
  Number.isInteger(width) && Object.prototype.hasOwnProperty.call(ICNS_TYPE_BY_SIZE, width);

export const encodeIcns = async (entries: { width: number; blob: Blob }[]): Promise<Blob> => {
  if (entries.length === 0) {
    throw new Error('ICNS requires at least one representation.');
  }

  // Deduplicate by physical size (last entry wins) — an ICNS must not carry two
  // representations of the same size.
  const bySize = new Map<number, ArrayBuffer>();
  for (const entry of entries) {
    if (!isSupportedSize(entry.width)) {
      throw new Error(`Unsupported ICNS size: ${entry.width} (supported: ${Object.keys(ICNS_TYPE_BY_SIZE).join(', ')}).`);
    }
    bySize.set(entry.width, await entry.blob.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let total = 8; // header
  for (const width of [...bySize.keys()].sort((a, b) => a - b)) {
    const data = bySize.get(width)!;
    const chunk = new Uint8Array(8 + data.byteLength);
    chunk.set(new TextEncoder().encode(ICNS_TYPE_BY_SIZE[width]), 0);
    new DataView(chunk.buffer).setUint32(4, 8 + data.byteLength, false); // big-endian
    chunk.set(new Uint8Array(data), 8);
    chunks.push(chunk);
    total += 8 + data.byteLength;
  }

  const header = new Uint8Array(8);
  header.set(new TextEncoder().encode('icns'), 0);
  new DataView(header.buffer).setUint32(4, total, false);

  return new Blob([header, ...chunks] as unknown as BlobPart[], { type: EXPORT_FORMAT_MIME.icns });
};