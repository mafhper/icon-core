import { describe, expect, it, vi } from 'vitest';
import type { ExportArtifactSpec, IconCoreProject, IconLayer, IconVariant } from '@iconcore/shared';
import type { RenderBackend, RenderContext } from '@iconcore/renderer';
import { encodeRaster } from '../src/encoders/raster';
import type { RasterFormat } from '../src/encoders/raster';

/**
 * `safeZone` — a restrição que nenhum alvo anterior tinha.
 *
 * ## O problema que ela resolve
 *
 * A camada `foreground` de um adaptive icon do Android é **108×108dp**, mas só os
 * **66×66dp centrais** sobrevivem à máscara do launcher: os 18dp de cada lado são cortados
 * (ou usados para parallax). Um ícone exportado *full bleed* — que é o que todo o resto do
 * app faz, e com razão — fica com a borda comida em **todo** launcher Android.
 *
 * ## Por que a asserção é sobre a chamada de composição, e não sobre o PNG
 *
 * Este pacote roda em **node**, sem DOM: não há canvas para decodificar o PNG e medir a
 * caixa da tinta. Então a prova é o que foi **pedido ao backend** — `createCanvas` no
 * tamanho final, e `drawImage` com a largura reduzida e o deslocamento centralizado.
 *
 * Essa é a mesma honestidade do `textLayout.spec.ts`, que registra explicitamente o que
 * o pacote não consegue medir. Um teste que fingisse medir o PNG passaria sem medir nada.
 */
const camada = (): IconLayer => ({
  id: 'l1',
  name: 'shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 400, height: 400 } },
  transform: { x: 56, y: 56, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#3b82f6' }
});

const projeto = (): IconCoreProject =>
  ({
    schemaVersion: 3,
    metadata: { name: 'App', shortName: 'App' },
    canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
    variants: { default: {} },
    layers: [camada()],
    targets: [],
    exportProfile: { outputBaseName: 'app', quality: 0.95, generateReport: false }
  }) as unknown as IconCoreProject;

/**
 * O canvas precisa ter **todos** os métodos que o compositor usa, e eles vão em
 * `native` — é o próprio `CanvasRenderingContext2D` (`composeLayers` faz
 * `ctx.native as CanvasRenderingContext2D`).
 *
 * A primeira versão pôs os métodos no objeto errado e todos os 9 testes caíram em
 * `ctxAny.save is not a function` — falha do fake, que parece falha da safe zone.
 */
const nativeCompleto = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createConicGradient: undefined,
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  rect: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  roundRect: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  fill: vi.fn(),
  clip: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  filter: 'none',
  fillStyle: ''
});

const ctxCompleto = (width: number, height: number) =>
  ({ width, height, native: nativeCompleto() }) as unknown as RenderContext;

const backendFalso = () => {
  const backend = {
    loadImage: vi.fn(async () => ({ width: 216, height: 216, native: {} })),
    createCanvas: vi.fn(ctxCompleto),
    drawImage: vi.fn(),
    applyTransform: vi.fn(),
    applyMask: vi.fn(),
    applyFill: vi.fn(),
    applyOpacity: vi.fn(),
    applyBlendMode: vi.fn(),
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    resize: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    destroy: vi.fn()
  } as unknown as RenderBackend & { toBlob: ReturnType<typeof vi.fn> };

  return backend;
};

const artefato = (spec: Partial<ExportArtifactSpec>): ExportArtifactSpec & { format: RasterFormat } =>
  ({ id: 'a1', format: 'png', path: 'fg.png', enabled: true, size: 216, ...spec }) as ExportArtifactSpec &
    { format: RasterFormat };

const rodar = async (spec: Partial<ExportArtifactSpec>) => {
  const backend = backendFalso();
  await encodeRaster(artefato(spec), projeto(), 'default' as IconVariant, backend);
  return backend;
};

describe('safeZone', () => {
  it('ausente nao compõe nada: e full bleed, como sempre foi', async () => {
    // A regressão que importa: `safeZone` e' opcional e aditivo. Quem nunca pediu tem que
    // receber exatamente o PNG que recebia antes — sem recomposição.
    //
    // O discriminador é o **número de canvases**: o compositor cria um para compor a
    // arte, e a safe zone cria um segundo para conter a arte reduzida. Duas tentativas
    // de afirmar por `drawImage` e por `createCanvas` falharam — o compositor usa os dois
    // (`drawImage` para as camadas de imagem, `createCanvas` para compor). Contar é o
    // que separa "o compositor fez o seu trabalho" de "a safe zone trabalhou".
    const backend = await rodar({});
    expect(backend.createCanvas).toHaveBeenCalledTimes(1);
  });

  it('safeZone === 1 tambem nao recompoe nada', async () => {
    const backend = await rodar({ safeZone: 1 });
    expect(backend.createCanvas).toHaveBeenCalledTimes(1);
  });

  it('reduz para a fracao e centraliza no tamanho final', async () => {
    // 216px x 66/108 = 132. O deslocamento e' (216 - 132) / 2 = 42.
    const backend = await rodar({ safeZone: 66 / 108, size: 216 });
    expect(backend.createCanvas).toHaveBeenCalledWith(216, 216);
    expect(backend.drawImage).toHaveBeenCalledWith(expect.anything(), expect.anything(), 42, 42, 132, 132);
  });

  it('o resultado tem o tamanho final, nao o da arte reduzida', async () => {
    // Se devolvesse o PNG reduzido, o `mipmap-xhdpi/ic_launcher_foreground.png` sairia com
    // 132px em vez de 216, e o Android escalaria por cima — borrao.
    //
    // E' o **último** `toBlob`: o compositor ja chama `toBlob` no canvas de 512 (o canvas
    // do projeto) antes da recomposição. A primeira versão leu `calls[0]`, viu 512, e
    // falhou — o codigo estava certo e a asserção media a etapa errada.
    const backend = await rodar({ safeZone: 66 / 108, size: 216 });
    expect(backend.toBlob).toHaveBeenCalled();
    const chamadas = backend.toBlob.mock.calls as unknown as [RenderContext][];
    const [ctx] = chamadas[chamadas.length - 1];
    expect(ctx.width).toBe(216);
    expect(ctx.height).toBe(216);
  });

  it('arredonda as medidas, porque meio pixel vira pixel errado', async () => {
    // 101 x 66/108 = 61.67 -> 62;  (101 - 62) / 2 = 19.5 -> 20 (Math.round).
    const backend = await rodar({ safeZone: 66 / 108, size: 101 });
    expect(backend.drawImage).toHaveBeenCalledWith(expect.anything(), expect.anything(), 20, 20, 62, 62);
  });

  it.each([0, -1, 1.5, Number.NaN])('reprova safeZone invalido: %s', async (valor) => {
    // Um preset com valor quebrado e' erro de **dado**, nao de codigo. Lancar aqui aborta
    // o export inteiro sem dizer o que esta errado; um PNG transparente silencioso e'
    // pior, porque a pessoa so descobre no launcher.
    await expect(rodar({ safeZone: valor })).rejects.toThrow(/safeZone/);
  });
});