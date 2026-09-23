import { describe, expect, it, vi } from 'vitest';
import type {
  ExportContainerSpec,
  ExportArtifactSpec,
  IconCoreProject,
  IconLayer
} from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '@iconcore/renderer';
import { encodeArtifact, encodeIco, encodeIcns } from '../src/encoders';

function createMockBackend(options?: { imageSize?: { width: number; height: number } }): RenderBackend {
  const mockCtx = {
    fillRect: vi.fn(),
    fillStyle: '',
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['fake-png'], { type: 'image/png' }))) }
  };

  return {
    loadImage: vi.fn(
      async (): Promise<ImageHandle> => ({
        width: options?.imageSize?.width ?? 128,
        height: options?.imageSize?.height ?? 128,
        native: {}
      })
    ),
    createCanvas: vi.fn((width: number, height: number): RenderContext => ({ width, height, native: mockCtx })),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['fake-png'], { type: 'image/png' })),
    resize: vi.fn(
      async (_src: Blob, w: number, h: number, format?: string, _quality?: number): Promise<Blob> =>
        new Blob([`png-${w}x${h}-${format ?? 'png'}`], { type: `image/${format ?? 'png'}` })
    ),
    destroy: vi.fn()
  };
}

const createProject = (layers: IconLayer[] = []): IconCoreProject => ({
  schemaVersion: 3,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers,
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
});

const readAsBytes = async (blob: Blob): Promise<{ bytes: Uint8Array; view: DataView }> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, view: new DataView(bytes.buffer) };
};

describe('encodeIco', () => {
  it('writes a valid ICO directory with PNG entries (256 uses the 0-byte convention)', async () => {
    const blob = await encodeIco([
      { width: 16, blob: new Blob(['png-16']) },
      { width: 256, blob: new Blob(['png-256']) }
    ]);
    const { bytes, view } = await readAsBytes(blob);

    // header
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // type icon
    expect(view.getUint16(4, true)).toBe(2); // count

    // dir[0] (16)
    expect(bytes[6]).toBe(16);
    expect(bytes[7]).toBe(16);
    expect(view.getUint16(10, true)).toBe(1); // planes
    expect(view.getUint16(12, true)).toBe(32); // bpp
    expect(view.getUint32(14, true)).toBe(6); // size 'png-16'
    expect(view.getUint32(18, true)).toBe(38); // offset

    // dir[1] (256)
    expect(bytes[22]).toBe(0); // >=256 -> 0
    expect(bytes[23]).toBe(0);
    expect(view.getUint32(30, true)).toBe(7); // size 'png-256'
    expect(view.getUint32(34, true)).toBe(44); // offset

    // embedded data
    expect(new TextDecoder().decode(bytes.subarray(38, 44))).toBe('png-16');
    expect(new TextDecoder().decode(bytes.subarray(44, 51))).toBe('png-256');
    expect(blob.type).toBe('image/x-icon');
  });

  it('rejects an empty entry list', async () => {
    await expect(encodeIco([])).rejects.toThrow('between 1 and 255');
  });
});

describe('encodeIcns', () => {
  it('writes a valid ICNS (header + OSType chunks, dedupes physical sizes)', async () => {
    const blob = await encodeIcns([
      { width: 32, blob: new Blob(['png-32']) },
      { width: 1024, blob: new Blob(['png-1024']) },
      { width: 32, blob: new Blob(['png-32b']) } // duplicate 32 — last wins
    ]);
    const { bytes, view } = await readAsBytes(blob);

    // 'png-32'=6, 'png-32b'=7, 'png-1024'=8 bytes → 8 + (8+7) + (8+8) = 39
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('icns');
    expect(view.getUint32(4, false)).toBe(39);

    // chunk 1: icp5 (32) → 'png-32b' (7 bytes)
    expect(new TextDecoder().decode(bytes.subarray(8, 12))).toBe('icp5');
    expect(view.getUint32(12, false)).toBe(8 + 7);
    expect(new TextDecoder().decode(bytes.subarray(16, 23))).toBe('png-32b');

    // chunk 2: ic10 (1024) → 'png-1024' (8 bytes)
    expect(new TextDecoder().decode(bytes.subarray(23, 27))).toBe('ic10');
    expect(view.getUint32(27, false)).toBe(8 + 8);
    expect(new TextDecoder().decode(bytes.subarray(31, 39))).toBe('png-1024');

    expect(blob.type).toBe('image/icns');
  });

  it('rejects unsupported sizes', async () => {
    await expect(
      encodeIcns([{ width: 48, blob: new Blob(['png-48']) }])
    ).rejects.toThrow('Unsupported ICNS size: 48');
  });

  it('rejects an empty entry list', async () => {
    await expect(encodeIcns([])).rejects.toThrow('at least one representation');
  });
});

describe('encodeArtifact — container', () => {
  it('renders PNGs per entry and wraps them in an ICO', async () => {
    const backend = createMockBackend();
    const artifact: ExportContainerSpec = {
      id: 'a-ico',
      format: 'ico',
      path: 'icon.ico',
      enabled: true,
      entries: [16, 256]
    };
    const { blob } = await encodeArtifact(artifact, createProject(), 'default', backend);
    const { bytes } = await readAsBytes(blob);
    const view = new DataView(bytes.buffer);

    expect(blob.type).toBe('image/x-icon');
    expect(view.getUint16(4, true)).toBe(2);
    expect(bytes[22]).toBe(0); // 256 entry
    expect(backend.resize).toHaveBeenCalledTimes(2);
  });

  it('renders PNGs per entry and wraps them in an ICNS', async () => {
    const backend = createMockBackend();
    const artifact: ExportContainerSpec = {
      id: 'a-icns',
      format: 'icns',
      path: 'icon.icns',
      enabled: true,
      entries: [32, 128]
    };
    const { blob, warnings } = await encodeArtifact(artifact, createProject(), 'default', backend);

    expect(blob.type).toBe('image/icns');
    expect(warnings).toEqual([]);
    const { bytes } = await readAsBytes(blob);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('icns');
  });

  it('rejects a container without entries', async () => {
    const artifact: ExportContainerSpec = {
      id: 'a-ico',
      format: 'ico',
      path: 'icon.ico',
      enabled: true,
      entries: []
    };
    await expect(encodeArtifact(artifact, createProject(), 'default', createMockBackend())).rejects.toThrow(
      'has no entries'
    );
  });
});

describe('encodeArtifact — raster', () => {
  it('renders PNG with size and forwards quality for lossy formats', async () => {
    const backend = createMockBackend();
    const artifact: ExportArtifactSpec = {
      id: 'a-webp',
      format: 'webp',
      path: 'icon.webp',
      enabled: true,
      size: 64,
      quality: 0.8
    };
    const { blob } = await encodeArtifact(artifact, createProject(), 'default', backend);

    expect(blob.type).toBe('image/webp');
    expect(backend.resize).toHaveBeenCalledWith(expect.anything(), 64, 64, 'webp', 0.8);
  });

  it('warns when an opaque raster artifact is exported from a transparent project', async () => {
    const backend = createMockBackend();
    const project = createProject();
    project.canvas.background = { kind: 'none' } as never;
    const artifact: ExportArtifactSpec = {
      id: 'a-maskable',
      format: 'png',
      path: 'maskable.png',
      enabled: true,
      size: 512,
      background: 'opaque'
    };
    const { warnings } = await encodeArtifact(artifact, project, 'default', backend);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('maskable.png');
    expect(warnings[0]).toContain('transparent');
  });
});

describe('encodeArtifact — SVG', () => {
  it('embeds raster image layers as data URIs via backend-resolved sizes', async () => {
    const imageLayer: IconLayer = {
      id: 'img-1',
      name: 'Photo',
      kind: 'image',
      visible: true,
      zIndex: 1,
      source: { type: 'inline', mimeType: 'image/png', data: 'cGhvdG8=' },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1
    };
    const backend = createMockBackend({ imageSize: { width: 256, height: 256 } });
    const artifact: ExportArtifactSpec = {
      id: 'a-svg',
      format: 'svg',
      path: 'icon.svg',
      enabled: true
    };
    const { blob, warnings } = await encodeArtifact(artifact, createProject([imageLayer]), 'default', backend);

    expect(blob.type).toBe('image/svg+xml');
    expect(warnings).toEqual([]);
    const svg = await blob.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('<image');
    expect(svg).toContain('href="data:image/png;base64,cGhvdG8="');
    // contain-fit 256 -> 512 → scale 2
    expect(svg).toContain('scale(2,2)');
  });

  it('supports opt-out of image embedding per artifact (embedImages: false)', async () => {
    const imageLayer: IconLayer = {
      id: 'img-1',
      name: 'Photo',
      kind: 'image',
      visible: true,
      zIndex: 1,
      source: { type: 'inline', mimeType: 'image/png', data: 'cGhvdG8=' },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1
    };
    const backend = createMockBackend({ imageSize: { width: 256, height: 256 } });
    const artifact: ExportArtifactSpec = {
      id: 'a-svg',
      format: 'svg',
      path: 'icon.svg',
      enabled: true
    };
    const { blob, warnings } = await encodeArtifact(
      artifact,
      createProject([imageLayer]),
      'default',
      backend,
      { svg: { embedImages: false } }
    );

    expect(warnings).toEqual([]);
    expect(await blob.text()).not.toContain('<image');
  });
});