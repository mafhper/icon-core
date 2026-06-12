import { describe, expect, it, vi } from 'vitest';
import type { IconCoreProject, Fill, ShapeKind, SafeArea } from '@iconcore/shared';
import type { RenderBackend, RenderContext, ImageHandle } from '../src/types';

function safeAreaToShapeKind(sa: SafeArea | undefined): { inset: number; shape: ShapeKind } | undefined {
  if (!sa) return undefined;
  return { inset: sa.inset, shape: sa.shape === 'square' ? 'rectangle' : sa.shape };
}

function createMockBackend(): RenderBackend {
  const canvases: Map<string, RenderContext> = new Map();
  let nextId = 0;

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
    canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob([], { type: 'image/png' }))) }
  };

  return {
    loadImage: vi.fn(async (_source: string | Blob): Promise<ImageHandle> => ({
      width: 128,
      height: 128,
      native: {}
    })),
    createCanvas: vi.fn((width: number, height: number): RenderContext => {
      const id = String(nextId++);
      const ctx: RenderContext = { width, height, native: mockCtx };
      canvases.set(id, ctx);
      return ctx;
    }),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob([], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob([], { type: 'image/png' })),
    destroy: vi.fn()
  };
}

describe('Canvas backend', () => {
  it('creates a canvas context with correct dimensions', async () => {
    const backend = createMockBackend();
    const ctx = backend.createCanvas(256, 256);
    expect(ctx.width).toBe(256);
    expect(ctx.height).toBe(256);
    backend.destroy();
  });

  it('applies a solid fill', async () => {
    const backend = createMockBackend();
    const ctx = backend.createCanvas(100, 100);
    const fill: Fill = { kind: 'solid', color: '#ff0000' };
    backend.applyFill(ctx, fill, 0, 0, 100, 100);
    expect(backend.applyFill).toHaveBeenCalledWith(ctx, fill, 0, 0, 100, 100);
    backend.destroy();
  });

  it('applies opacity', async () => {
    const backend = createMockBackend();
    const ctx = backend.createCanvas(100, 100);
    backend.applyOpacity(ctx, 0.5);
    expect(backend.applyOpacity).toHaveBeenCalledWith(ctx, 0.5);
    backend.destroy();
  });

  it('resizes an image', async () => {
    const backend = createMockBackend();
    const result = await backend.resize(new Blob([]), 32, 32);
    expect(backend.resize).toHaveBeenCalled();
    expect(result).toBeDefined();
    backend.destroy();
  });
});

describe('composeLayers', () => {
  const solidFill: Fill = { kind: 'solid', color: '#3366cc' };

  const createMinimalProject = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
    schemaVersion: 2,
    metadata: { name: 'Test', shortName: 'Test' },
    canvas: { size: 128, background: solidFill },
    layers: [],
    variants: { default: {} },
    targets: [{ target: 'web-favicon', enabled: true }],
    exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
    ...overrides
  });

  it('renders a project with no layers as just background', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const project = createMinimalProject();
    const blob = await composeLayers(
      project.layers,
      project.canvas.size,
      project.canvas.background,
      'default',
      safeAreaToShapeKind(project.canvas.safeArea),
      backend
    );
    expect(blob).toBeDefined();
    expect(backend.createCanvas).toHaveBeenCalledWith(128, 128);
    backend.destroy();
  });

  it('renders a project with a visible shape layer', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const project = createMinimalProject({
      layers: [{
        id: 'bg-shape',
        name: 'Background Shape',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'inline', mimeType: 'image/png', data: '' },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#cc3333' }
      }]
    });
    const blob = await composeLayers(
      project.layers,
      project.canvas.size,
      project.canvas.background,
      'default',
      safeAreaToShapeKind(project.canvas.safeArea),
      backend
    );
    expect(blob).toBeDefined();
    expect(backend.applyFill).toHaveBeenCalled();
    backend.destroy();
  });

  it('skips invisible layers', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const project = createMinimalProject({
      layers: [{
        id: 'hidden',
        name: 'Hidden Layer',
        kind: 'image',
        visible: false,
        zIndex: 0,
        source: { type: 'inline', mimeType: 'image/png', data: '' },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1
      }]
    });
    const blob = await composeLayers(
      project.layers,
      project.canvas.size,
      solidFill,
      'default',
      undefined,
      backend
    );
    expect(blob).toBeDefined();
    backend.destroy();
  });
});

describe('sanitizeSvg', () => {
  it('removes script tags', async () => {
    const { sanitizeSvg } = await import('../src/sanitizeSvg');
    const input = '<svg><script>alert("xss")</script><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('<rect');
  });

  it('removes iframe tags', async () => {
    const { sanitizeSvg } = await import('../src/sanitizeSvg');
    const input = '<svg><iframe src="evil.com"></iframe><circle/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<iframe');
  });

  it('preserves valid SVG content', async () => {
    const { sanitizeSvg } = await import('../src/sanitizeSvg');
    const input = '<svg><rect x="0" y="0" width="100" height="100" fill="red"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).toContain('<rect');
    expect(result).toContain('fill="red"');
  });
});

describe('renderToSvg', () => {
  const solidFill: Fill = { kind: 'solid', color: '#ffffff' };

  it('generates valid SVG string from project', async () => {
    const { renderToSvg } = await import('../src/renderToSvg');
    const project: IconCoreProject = {
      schemaVersion: 2,
      metadata: { name: 'Test', shortName: 'Test' },
      canvas: { size: 128, background: solidFill },
      layers: [],
      variants: { default: {} },
      targets: [{ target: 'web-favicon', enabled: true }],
      exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
    };

    const svg = renderToSvg(project, 'default');
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="128"');
    expect(svg).toContain('height="128"');
    expect(svg).toContain('#ffffff');
  });

  it('includes shape layers in SVG output', async () => {
    const { renderToSvg } = await import('../src/renderToSvg');
    const project: IconCoreProject = {
      schemaVersion: 2,
      metadata: { name: 'Test', shortName: 'Test' },
      canvas: { size: 64, background: solidFill },
      layers: [{
        id: 'circle',
        name: 'Circle',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: 'test.svg', shape: { kind: 'circle', width: 40, height: 40 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#ff0000' }
      }],
      variants: { default: {} },
      targets: [{ target: 'web-favicon', enabled: true }],
      exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false }
    };

    const svg = renderToSvg(project, 'default');
    expect(svg).toContain('<circle');
  });
});

describe('Masks', () => {
  it('applyMask exports correctly', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    expect(applyMask).toBeDefined();
    expect(typeof applyMask).toBe('function');
  });

  it('applyMask calls save/restore on context', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    const mockNative = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      translate: vi.fn()
    };
    const ctx: RenderContext = { width: 128, height: 128, native: mockNative };

    applyMask(ctx, 'circle', 128);
    expect(mockNative.save).toHaveBeenCalled();
    expect(mockNative.restore).toHaveBeenCalled();
  });

  it('applyMask handles circle shape', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    const mockNative = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      translate: vi.fn()
    };
    const ctx: RenderContext = { width: 128, height: 128, native: mockNative };

    applyMask(ctx, 'circle', 128);
    expect(mockNative.arc).toHaveBeenCalled();
    expect(mockNative.clip).toHaveBeenCalled();
  });

  it('applyMask handles rounded-rectangle shape', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    const mockNative = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      translate: vi.fn()
    };
    const ctx: RenderContext = { width: 128, height: 128, native: mockNative };

    applyMask(ctx, 'rounded-rectangle', 128);
    expect(mockNative.roundRect).toHaveBeenCalled();
    expect(mockNative.clip).toHaveBeenCalled();
  });

  it('applyMask handles square shape (no-op)', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    const mockNative = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      translate: vi.fn()
    };
    const ctx: RenderContext = { width: 128, height: 128, native: mockNative };

    applyMask(ctx, 'rectangle', 128);
    expect(mockNative.save).toHaveBeenCalled();
    expect(mockNative.restore).toHaveBeenCalled();
  });

  it('applyMask handles inset parameter', async () => {
    const { applyMask } = await import('../src/masks/applyMask');
    const mockNative = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      translate: vi.fn()
    };
    const ctx: RenderContext = { width: 128, height: 128, native: mockNative };

    applyMask(ctx, 'circle', 128, 10);
    expect(mockNative.rect).toHaveBeenCalled();
    expect(mockNative.arc).toHaveBeenCalled();
  });
});

describe('renderProject', () => {
  const solidFill: Fill = { kind: 'solid', color: '#ffffff' };

  const createProject = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
    schemaVersion: 2,
    metadata: { name: 'Test', shortName: 'Test' },
    canvas: { size: 128, background: solidFill },
    layers: [],
    variants: { default: {} },
    targets: [{ target: 'web-favicon', enabled: true }],
    exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
    ...overrides
  });

  it('renders at original size without resize', async () => {
    const { renderProject } = await import('../src/renderProject');
    const backend = createMockBackend();
    const project = createProject();

    const blob = await renderProject(project, 'default', 128, backend);
    expect(blob).toBeDefined();
    expect(backend.resize).not.toHaveBeenCalled();
    backend.destroy();
  });

  it('resizes when target size differs from canvas size', async () => {
    const { renderProject } = await import('../src/renderProject');
    const backend = createMockBackend();
    const project = createProject();

    const blob = await renderProject(project, 'default', 64, backend);
    expect(blob).toBeDefined();
    expect(backend.resize).toHaveBeenCalled();
    backend.destroy();
  });

  it('uses variant-specific background when available', async () => {
    const { renderProject } = await import('../src/renderProject');
    const backend = createMockBackend();
    const darkFill: Fill = { kind: 'solid', color: '#000000' };
    const project = createProject({
      variants: {
        default: {},
        dark: { canvas: { background: darkFill } }
      }
    });

    const blob = await renderProject(project, 'dark', 128, backend);
    expect(blob).toBeDefined();
    expect(backend.applyFill).toHaveBeenCalled();
    backend.destroy();
  });

  it('falls back to default background when variant has no override', async () => {
    const { renderProject } = await import('../src/renderProject');
    const backend = createMockBackend();
    const project = createProject({
      variants: { default: {} }
    });

    const blob = await renderProject(project, 'default', 128, backend);
    expect(blob).toBeDefined();
    backend.destroy();
  });
});

describe('composeLayers edge cases', () => {
  const solidFill: Fill = { kind: 'solid', color: '#3366cc' };

  it('sorts layers by zIndex', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const layers = [
      {
        id: 'layer-2',
        name: 'Layer 2',
        kind: 'image' as const,
        visible: true,
        zIndex: 2,
        source: { type: 'reference' as const, path: 'layer2.png', shape: { kind: 'circle' as const, width: 50, height: 50 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid' as const, color: '#0000ff' }
      },
      {
        id: 'layer-1',
        name: 'Layer 1',
        kind: 'image' as const,
        visible: true,
        zIndex: 1,
        source: { type: 'reference' as const, path: 'layer1.png', shape: { kind: 'circle' as const, width: 50, height: 50 } },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid' as const, color: '#ff0000' }
      }
    ];

    const blob = await composeLayers(layers, 128, solidFill, 'default', undefined, backend);
    expect(blob).toBeDefined();
    expect(backend.applyFill).toHaveBeenCalledTimes(3);
    backend.destroy();
  });

  it('applies blend mode when not normal', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const layers = [{
      id: 'blend-layer',
      name: 'Blend Layer',
      kind: 'image' as const,
      visible: true,
      zIndex: 0,
      source: { type: 'reference' as const, path: 'blend.png', shape: { kind: 'circle' as const, width: 50, height: 50 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      blendMode: 'multiply' as const,
      fill: { kind: 'solid' as const, color: '#ff0000' }
    }];

    const blob = await composeLayers(layers, 128, solidFill, 'default', undefined, backend);
    expect(blob).toBeDefined();
    expect(backend.applyBlendMode).toHaveBeenCalled();
    backend.destroy();
  });

  it('applies opacity when less than 1', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const layers = [{
      id: 'opacity-layer',
      name: 'Opacity Layer',
      kind: 'image' as const,
      visible: true,
      zIndex: 0,
      source: { type: 'reference' as const, path: 'opacity.png', shape: { kind: 'circle' as const, width: 50, height: 50 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 0.5,
      fill: { kind: 'solid' as const, color: '#ff0000' }
    }];

    const blob = await composeLayers(layers, 128, solidFill, 'default', undefined, backend);
    expect(blob).toBeDefined();
    expect(backend.applyOpacity).toHaveBeenCalled();
    backend.destroy();
  });

  it('applies transform when present', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const layers = [{
      id: 'transform-layer',
      name: 'Transform Layer',
      kind: 'image' as const,
      visible: true,
      zIndex: 0,
      source: { type: 'reference' as const, path: 'transform.png', shape: { kind: 'circle' as const, width: 50, height: 50 } },
      transform: { x: 10, y: 20, scale: 1.5, rotation: 45 },
      opacity: 1,
      fill: { kind: 'solid' as const, color: '#ff0000' }
    }];

    const blob = await composeLayers(layers, 128, solidFill, 'default', undefined, backend);
    expect(blob).toBeDefined();
    expect(backend.applyTransform).toHaveBeenCalled();
    backend.destroy();
  });

  it('resolves variant source, transform, opacity, visibility, blend, fill, and effects before rendering', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();
    const layers = [{
      id: 'variant-layer',
      name: 'Variant Layer',
      kind: 'shape' as const,
      visible: false,
      zIndex: 0,
      source: { type: 'reference' as const, path: '', shape: { kind: 'circle' as const, width: 40, height: 40 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      blendMode: 'normal' as const,
      fill: { kind: 'solid' as const, color: '#ff0000' },
      variantOverrides: {
        dark: {
          visible: true,
          source: { type: 'reference' as const, path: '', shape: { kind: 'rounded-rectangle' as const, width: 64, height: 64, cornerRadius: 16 } },
          transform: { x: 10, y: 14, scale: 1.5, rotation: 12 },
          opacity: 0.5,
          blendMode: 'multiply' as const,
          fill: { kind: 'solid' as const, color: '#00ff00' },
          effects: [{ kind: 'depth-shadow' as const, enabled: true, params: { x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.3)' } }]
        }
      }
    }];

    const blob = await composeLayers(layers, 128, solidFill, 'dark', undefined, backend);
    expect(blob).toBeDefined();
    expect(backend.applyTransform).toHaveBeenCalledWith(expect.anything(), { x: 10, y: 14, scale: 1.5, rotation: 12 });
    expect(backend.applyOpacity).toHaveBeenCalledWith(expect.anything(), 0.5);
    expect(backend.applyBlendMode).toHaveBeenCalledWith(expect.anything(), 'multiply');
    expect(backend.applyFill).toHaveBeenCalledWith(expect.anything(), { kind: 'solid', color: '#00ff00' }, 32, 32, 64, 64);
    backend.destroy();
  });

  it('applies safe area mask when provided', async () => {
    const { composeLayers } = await import('../src/composeLayers');
    const backend = createMockBackend();

    const blob = await composeLayers(
      [],
      128,
      solidFill,
      'default',
      { inset: 10, shape: 'circle' },
      backend
    );
    expect(blob).toBeDefined();
    expect(backend.applyMask).toHaveBeenCalled();
    backend.destroy();
  });
});
