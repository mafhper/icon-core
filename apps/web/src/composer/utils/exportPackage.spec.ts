import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { zipFiles } from './exportPackage';

/**
 * Transport only (spec §2.5): the plan decides *what* is produced, this module
 * only decides how it is delivered. The README/report/manifest generators moved
 * to `@iconcore/exporters` (pipeline attachments) in EX4.
 */
describe('zipFiles', () => {
  it('writes each file at its planned path', async () => {
    const blob = await zipFiles([
      { path: 'icon.svg', blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }) },
      { path: 'icons/32x32.png', blob: new Blob(['png'], { type: 'image/png' }) }
    ]);

    const zip = await JSZip.loadAsync(blob);
    // JSZip materialises implicit folder entries; only count real files.
    const paths = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    expect(paths.sort()).toEqual(['icon.svg', 'icons/32x32.png']);
    expect(await zip.file('icon.svg')!.async('string')).toBe('<svg/>');
  });

  it('honours the store (no compression) option', async () => {
    const payload = new Blob(['x'.repeat(512)], { type: 'text/plain' });

    const deflated = await zipFiles([{ path: 'a.txt', blob: payload }], { compression: 'deflate', level: 9 });
    const stored = await zipFiles([{ path: 'a.txt', blob: payload }], { compression: 'store' });

    // STORE keeps the bytes verbatim, so the archive is measurably larger.
    expect(stored.size).toBeGreaterThan(deflated.size);
  });
});
