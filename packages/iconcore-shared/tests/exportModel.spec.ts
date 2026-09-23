import { describe, expect, it } from 'vitest';
import {
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_KIND,
  EXPORT_FORMAT_MIME,
  extensionForFormat,
  isContainerFormat,
  isContainerSpec,
  isLossyFormat,
  kindOf,
  supportsAlpha,
  type ExportArtifact,
  type ExportContainerSpec,
  type ExportFormat,
  type ExportPlan,
  type ExportProfile
} from '../src/index';

const FORMATS: ExportFormat[] = ['svg', 'png', 'webp', 'jpeg', 'ico', 'icns'];

describe('export artifact model (ADR-014)', () => {
  it('classifies every format into exactly one kind', () => {
    for (const format of FORMATS) {
      expect(EXPORT_FORMAT_KIND[format]).toBeDefined();
      expect(kindOf(format)).toBe(EXPORT_FORMAT_KIND[format]);
    }
    expect(kindOf('svg')).toBe('vector');
    expect(kindOf('png')).toBe('raster');
    expect(kindOf('webp')).toBe('raster');
    expect(kindOf('jpeg')).toBe('raster');
    expect(kindOf('ico')).toBe('container');
    expect(kindOf('icns')).toBe('container');
  });

  it('provides an extension and a mime type for every format', () => {
    for (const format of FORMATS) {
      expect(EXPORT_FORMAT_EXTENSION[format]).toBeTruthy();
      expect(EXPORT_FORMAT_MIME[format]).toBeTruthy();
      expect(extensionForFormat(format)).toBe(EXPORT_FORMAT_EXTENSION[format]);
    }
  });

  it('uses jpg as the jpeg extension (extension ⇔ format)', () => {
    expect(extensionForFormat('jpeg')).toBe('jpg');
    expect(extensionForFormat('png')).toBe('png');
    expect(extensionForFormat('ico')).toBe('ico');
  });

  it('flags jpeg as the only format without alpha and webp/jpeg as lossy', () => {
    for (const format of FORMATS) expect(supportsAlpha(format)).toBe(format !== 'jpeg');
    expect(isLossyFormat('webp')).toBe(true);
    expect(isLossyFormat('jpeg')).toBe(true);
    expect(isLossyFormat('png')).toBe(false);
    expect(isLossyFormat('svg')).toBe(false);
  });

  it('identifies container formats and narrows container specs', () => {
    expect(isContainerFormat('ico')).toBe(true);
    expect(isContainerFormat('icns')).toBe(true);
    expect(isContainerFormat('png')).toBe(false);

    const png: ExportArtifact = { id: 'a', format: 'png', path: 'icon.png', enabled: true, size: 512 };
    const ico: ExportArtifact = {
      id: 'b',
      format: 'ico',
      path: 'icon.ico',
      enabled: true,
      entries: [16, 32, 48, 256]
    };
    expect(isContainerSpec(png)).toBe(false);
    expect(isContainerSpec(ico)).toBe(true);
  });

  it('supports the acceptance use case: svg + png + webp + ico in one plan', () => {
    const plan: ExportPlan = {
      artifacts: [
        { id: 'brand', format: 'svg', path: 'brand/icon.svg', enabled: true },
        { id: 'app', format: 'png', path: 'app/icon.png', enabled: true, size: 512 },
        { id: 'github', format: 'webp', path: 'github/icon.webp', enabled: true, size: 512, quality: 0.9 },
        { id: 'windows', format: 'ico', path: 'windows/icon.ico', enabled: true, entries: [16, 24, 32, 48, 64, 256] }
      ],
      attachments: [{ path: 'site.webmanifest', generator: 'manifest' }]
    };

    expect(plan.artifacts).toHaveLength(4);
    expect(plan.artifacts.filter((artifact) => artifact.enabled)).toHaveLength(4);
    const container = plan.artifacts.find((artifact): artifact is ExportContainerSpec => isContainerSpec(artifact));
    expect(container?.entries).toEqual([16, 24, 32, 48, 64, 256]);
  });

  it('keeps the legacy ExportProfile valid and the artifact fields additive', () => {
    const legacy: ExportProfile = { outputBaseName: 'my-icon', quality: 0.92, generateReport: true };
    expect(legacy.artifacts).toBeUndefined();

    const modern: ExportProfile = {
      ...legacy,
      presetId: 'tauri',
      destination: 'zip',
      artifacts: [{ id: 'w', format: 'ico', path: 'icon.ico', enabled: true, entries: [16, 32, 48, 256] }]
    };
    expect(modern.presetId).toBe('tauri');
    expect(modern.destination).toBe('zip');
    expect(modern.artifacts).toHaveLength(1);
  });
});
