import { describe, expect, it } from 'vitest';
import { fileToLayerAsset } from './fileLayers';

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
