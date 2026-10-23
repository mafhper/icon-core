import { describe, expect, it, vi } from 'vitest';
import type { ExportArtifactSpec, IconCoreProject, IconLayer, IconVariant } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { getPreset } from '../src/presets';
import { encodeRaster } from '../src/encoders/raster';
import type { RasterFormat } from '../src/encoders/raster';

/**
 * As duas camadas do adaptive icon: o que cada uma **desenha**.
 *
 * O preset declara as duas com 108dp e `safeZone` só na foreground — e esses campos estavam
 * certos desde o começo. O que ninguém media é o que sai de fato: `renderProject` compõe
 * **todas** as layers do documento em qualquer render, então a camada de fundo recebia a
 * marca junto com o preenchimento.
 *
 * O Android não soma duas imagens idênticas: ele desenha o `background` cobrindo os 108dp e
 * o `foreground` por cima, e **amplia a camada de fundo em 1,5×** (o miolo visível é 72 de
 * 108). Com a marca duplicada, o "M" do fundo aparece maior e deslocado — o ícone mostra dois
 * "M", um esticado. Medido no conjunto do mytube: o fundo trazia a marca em **61,8%** da
 * largura (escala da tela) enquanto a foreground a trazia em **38,4%** (a safe zone).
 *
 * O backend abaixo não produz pixels — ele registra **o que o compositor foi instruído a
 * desenhar**. É o mesmo critério do `exportBackground.spec.ts`: a asserção é sobre o desenho
 * pedido, porque é isso que um mock consegue provar, e o pixel é provado no conjunto real.
 */
const createRecordingBackend = (): RenderBackend & {
  artTextPaints: number;
  fills: Array<{ fill: unknown; w: number; h: number }>;
  size: number;
} => {
  const fills: Array<{ fill: unknown; w: number; h: number }> = [];
  let artTextPaints = 0;
  let size = 0;

  const makeCtx = (width: number, height: number): RenderContext => {
    size = Math.max(size, width);
    const native = {
      fillRect: vi.fn(),
      fillText: vi.fn(() => {
        artTextPaints += 1;
      }),
      measureText: vi.fn(() => ({ width: 100 })),
      fillStyle: '',
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowColor: '',
      filter: '',
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
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      clip: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
      canvas: { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' }))) }
    };
    return { width, height, native } as unknown as RenderContext;
  };

  const backend = {
    loadImage: vi.fn(async () => ({ width: 128, height: 128, native: {} })),
    createCanvas: vi.fn(makeCtx),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn((_ctx: RenderContext, fill: unknown, _x: number, _y: number, w: number, h: number) => {
      fills.push({ fill, w, h });
    }),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    destroy: vi.fn()
  } as unknown as RenderBackend & {
    artTextPaints: number;
    fills: Array<{ fill: unknown; w: number; h: number }>;
    size: number;
  };

  backend.fills = fills;
  Object.defineProperty(backend, 'artTextPaints', { get: () => artTextPaints });
  Object.defineProperty(backend, 'size', { get: () => size });
  return backend;
};

/**
 * O documento do mytube, reduzido ao que importa: um fundo em gradiente no canvas e **uma
 * marca desenhada por layer**. Se a camada de fundo do adaptive sair com a marca, este texto
 * é pintado duas vezes no ícone composto.
 */
const marca: IconLayer = {
  id: 'texto',
  name: 'Text 1',
  kind: 'text',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 297, height: 102 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#111827' },
  text: { content: 'M', fontFamily: 'sans-serif', fontSize: 400, fontWeight: 700 }
};

const projeto = (): IconCoreProject =>
  ({
    schemaVersion: 3,
    metadata: { name: 'MyTube', shortName: 'MyTube' },
    canvas: {
      size: 512,
      background: {
        kind: 'linear-gradient',
        angle: 134,
        stops: [
          { offset: 0, color: '#e97559' },
          { offset: 1, color: '#740000' }
        ]
      }
    },
    layers: [marca],
    variants: { default: {}, light: {}, dark: {}, mono: {} },
    targets: [],
    exportProfile: { outputBaseName: 'mytube', quality: 0.95, generateReport: false, presetId: 'android' }
  }) as unknown as IconCoreProject;

const variante: IconVariant = 'default';

const artifactDoPreset = (suffix: string): ExportArtifactSpec & { format: RasterFormat } => {
  const preset = getPreset('android');
  if (!preset) throw new Error('preset android ausente');
  const found = preset
    .createArtifacts({ project: projeto(), variants: [variante] })
    .find((a) => a.path.endsWith(suffix));
  if (!found) throw new Error(`artefato ${suffix} ausente no preset android`);
  return found as ExportArtifactSpec & { format: RasterFormat };
};

describe('adaptive icon — a camada de fundo não desenha a marca', () => {
  it('a background pinta o fundo do canvas e nenhuma layer da arte', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifactDoPreset('xhdpi/ic_launcher_background.png'), projeto(), variante, backend);

    // O preenchimento do canvas sai; a marca, não. Sem isso o launcher compõe a marca duas
    // vezes — uma esticada pela camada de fundo, outra na frente.
    expect(backend.artTextPaints).toBe(0);
    expect(backend.fills.some((c) => c.w === 512 && c.h === 512)).toBe(true);
  });

  it('a foreground desenha a marca e não pinta o fundo', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifactDoPreset('xhdpi/ic_launcher_foreground.png'), projeto(), variante, backend);

    expect(backend.artTextPaints).toBe(1);
    expect(backend.fills).toEqual([]);
  });

  it('a camada monocromática também não carrega o fundo', async () => {
    const backend = createRecordingBackend();
    await encodeRaster(artifactDoPreset('xhdpi/ic_launcher_monochrome.png'), projeto(), variante, backend);

    // O sistema **tinge** esta camada: pintar o fundo viraria um bloco sólido tingido.
    expect(backend.artTextPaints).toBe(1);
    expect(backend.fills).toEqual([]);
  });
});
