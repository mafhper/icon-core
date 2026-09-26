import { describe, expect, it } from 'vitest';
import { fileToLayerAsset, measureIntrinsicSize } from './fileLayers';

const svgFile = (svg: string, name = 'logo.svg') => new File([svg], name, { type: 'image/svg+xml' });

/**
 * Regression coverage for F3 — an SVG must be measured from its own document.
 * The parser itself is covered in `@iconcore/renderer` (`svgSize.spec.ts`); here
 * we assert the asset the importer actually produces.
 */
describe('fileToLayerAsset', () => {
  it('measures an SVG from its own document instead of assuming a square', async () => {
    const asset = await fileToLayerAsset(svgFile('<svg viewBox="0 0 48 24"></svg>'));

    expect(asset.width).toBe(48);
    expect(asset.height).toBe(24);
    expect(asset.mimeType).toBe('image/svg+xml');
    expect(asset.name).toBe('logo');
  });

  it('keeps the base64 payload decodable', async () => {
    const svg = '<svg width="16" height="8"></svg>';
    const asset = await fileToLayerAsset(svgFile(svg, 'badge.svg'));

    expect(atob(asset.data)).toBe(svg);
    expect(asset.width).toBe(16);
    expect(asset.height).toBe(8);
  });

  it('falls back to rasterisation when the document declares no intrinsic size', async () => {
    // jsdom has no createImageBitmap, so the last-resort size is used instead of
    // guessing a shape for a document that genuinely has no intrinsic size.
    const asset = await fileToLayerAsset(svgFile('<svg width="100%" height="100%"></svg>'));

    expect(asset.width).toBe(512);
    expect(asset.height).toBe(512);
  });
});

/**
 * IC3 §4.2 (option C) — the "Reset aspect" action measures the stored payload
 * with the same helper the importer uses. If these two diverged, a straightened
 * layer could be squashed again on the next import.
 */
describe('measureIntrinsicSize', () => {
  it('measures a stored SVG payload from its own document', async () => {
    const size = await measureIntrinsicSize('image/svg+xml', btoa('<svg viewBox="0 0 48 24"></svg>'));

    expect(size).toEqual({ width: 48, height: 24 });
  });

  it('measures from width/height with units', async () => {
    const size = await measureIntrinsicSize('image/svg+xml', btoa('<svg width="64" height="32"></svg>'));

    expect(size).toEqual({ width: 64, height: 32 });
  });

  it('accepts a percent-encoded payload', async () => {
    const size = await measureIntrinsicSize(
      'image/svg+xml',
      encodeURIComponent('<svg viewBox="0 0 48 24"></svg>')
    );

    expect(size).toEqual({ width: 48, height: 24 });
  });

  it('returns null for an SVG with no intrinsic size instead of guessing', async () => {
    const size = await measureIntrinsicSize('image/svg+xml', btoa('<svg width="100%" height="100%"></svg>'));

    expect(size).toBeNull();
  });

  it('returns null for a missing payload or mime type', async () => {
    expect(await measureIntrinsicSize(undefined, '')).toBeNull();
    expect(await measureIntrinsicSize('image/png', '')).toBeNull();
  });
});
