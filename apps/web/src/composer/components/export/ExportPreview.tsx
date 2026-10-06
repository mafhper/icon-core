import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultMaskRadius } from '@iconcore/shared';
import type { CanvasMaskShape, IconCoreProject, IconVariant } from '@iconcore/shared';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { auditProject } from '@iconcore/validator';

/**
 * Render the project the way the export will, before anything is written.
 *
 * The export screen used to show only a list of paths. That made a whole class
 * of import problem invisible until after the fact: an asset that lands small
 * inside the canvas — the tell is a band of background around the artwork —
 * looks fine in a file list and wrong in every place the icon is actually
 * used. The point of this panel is that you can see it, go back, and fix it
 * before shipping.
 *
 * Reuses the pattern already proven in `SizePreview`: a dedicated canvas
 * backend, object URLs, and a hard revoke on unmount.
 */

/**
 * Os tamanhos que os presets entregam, e o que cada um ocupa na coluna.
 *
 * `displaySize` **nao e proporcional** ao `size`, e isso e uma decisao, nao um
 * atalho. Proporcional nao caberia: a coluna tem cerca de 230px de largura, e
 * 512 + 180 + 32 dariam 724px de altura. Entao o 32 fica em 32px — 1:1, que e o que a
 * pessoa precisa julgar — e os dois maiores sao ampliados para caber.
 *
 * A versao anterior era `Math.min(size, 96)`: 180 e 512 davam 96 e 96, duas colunas
 * identicas lado a lado, sem como comparar. O cap de 96 nao tinha relacao com o tamanho,
 * entao nenhuma escolha de CSS resolvia.
 */
interface PreviewSize {
  size: number;
  displaySize: number;
}

const SIZES: readonly PreviewSize[] = [
  { size: 512, displaySize: 160 },
  { size: 180, displaySize: 96 },
  { size: 32, displaySize: 32 }
];

/** O menor render: e onde a arte que parou curto fica mais obvio. */
const SMALLEST = SIZES[SIZES.length - 1].size;

interface Thumb {
  url: string;
  /** Measured content box inside the rendered image, in pixels of that size. */
  fill: { top: number; right: number; bottom: number; left: number };
}

const useExportThumbs = (
  project: IconCoreProject | null,
  variant: IconVariant,
  enabled: boolean
): Map<number, Thumb> => {
  const [thumbs, setThumbs] = useState<Map<number, Thumb>>(new Map());
  const live = useRef<Map<number, Thumb>>(new Map());

  useEffect(() => {
    if (!project || !enabled || project.layers.length === 0) {
      setThumbs(new Map());
      return;
    }
    let cancelled = false;
    const backend = createCanvasBackend();

    const run = async () => {
      const entries: Array<[number, Thumb]> = [];
      for (const { size } of SIZES) {
        try {
          const blob = await renderProject(project, variant, { width: size, height: size }, backend);
          const bitmap = await createImageBitmap(blob);
          const fill = measureContentBox(bitmap);
          bitmap.close();
          entries.push([size, { url: URL.createObjectURL(blob), fill }]);
        } catch (err) {
          console.error(`Export preview ${size}px failed:`, err);
        }
      }
      if (cancelled) {
        entries.forEach(([, t]) => URL.revokeObjectURL(t.url));
        return;
      }
      live.current.forEach((t) => URL.revokeObjectURL(t.url));
      const map = new Map(entries);
      live.current = map;
      setThumbs(map);
    };

    void run();
    return () => {
      cancelled = true;
      backend.destroy();
    };
  }, [project, variant, enabled]);

  useEffect(
    () => () => {
      live.current.forEach((t) => URL.revokeObjectURL(t.url));
    },
    []
  );

  return thumbs;
};

/**
 * Smallest margin on each side of the rendered image, in pixels.
 *
 * This is what makes the "it did not fill the canvas" case visible: a band of
 * background on all four sides means the artwork is smaller than the box it
 * was placed in. Reading it off the rendered pixels is the only honest way —
 * the layer geometry alone cannot tell an asset that is intentionally inset
 * from one whose drawing stopped short of its own viewBox.
 */
const measureContentBox = (bitmap: ImageBitmap): Thumb['fill'] => {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { top: 0, right: 0, bottom: 0, left: 0 };
  ctx.drawImage(bitmap, 0, 0);

  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const corner = data.slice(0, 4);
  let top = bitmap.height;
  let right = 0;
  let bottom = 0;
  let left = bitmap.width;

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const i = (y * bitmap.width + x) * 4;
      // "Background" here means the corner pixel, whatever it is — the point
      // is the edge of what was drawn, not the presence of a colour.
      const same =
        Math.abs(data[i] - corner[0]) <= 6 &&
        Math.abs(data[i + 1] - corner[1]) <= 6 &&
        Math.abs(data[i + 2] - corner[2]) <= 6 &&
        Math.abs(data[i + 3] - corner[3]) <= 6;
      if (same) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  if (right < left || bottom < top) {
    return { top: 0, right: bitmap.width, bottom: bitmap.height, left: 0 };
  }
  return {
    top,
    right: bitmap.width - 1 - right,
    bottom: bitmap.height - 1 - bottom,
    left
  };
};

/** Largest single-side margin as a percentage of the size, for the warning. */
const worstMarginPct = (fill: Thumb['fill'], size: number): number => {
  const worst = Math.max(fill.top, fill.right, fill.bottom, fill.left);
  return Math.round((worst / size) * 100);
};

interface ExportPreviewProps {
  project: IconCoreProject;
  variant: IconVariant;
  /**
   * A mascara que o export vai recortar.
   *
   * Precisa vir de fora porque este painel tambem mostra **o recorte**: sem ela, a pessoa
   * julga um quadrado e exporta um icone cortado. Antes o componente so tinha
   * `project`, `variant` e `enabled` — nenhuma informacao sobre a forma final.
   */
  maskShape: CanvasMaskShape;
  /** Pause rendering (e.g. while the export is running). */
  enabled?: boolean;
}

/**
 * Preview panel for the export screen: the icon as it will be written, on a
 * light and a dark background, with the largest background band called out.
 */
export const ExportPreview = ({ project, variant, maskShape, enabled = true }: ExportPreviewProps) => {
  const thumbs = useExportThumbs(project, variant, enabled);
  const audit = useMemo(() => auditProject(project), [project]);

  // The smallest render is the one that matters for legibility, and it is also
  // the one where an inset artwork is most obvious.
  const smallest = SMALLEST;
  const thumb = thumbs.get(smallest);
  const marginPct = thumb ? worstMarginPct(thumb.fill, smallest) : 0;
  const inset = marginPct >= 10;

  return (
    <section className="card-surface ic-export-preview" aria-label="Export preview">
      <header className="ic-export-preview-head">
        <h3>Preview</h3>
        <p>Rendered the way it will be exported, before anything is written.</p>
      </header>

      {project.layers.length === 0 ? (
        <p className="ic-export-preview-empty">This project has no visible layer yet.</p>
      ) : (
        <>
          {/**
           * Uma coluna, do maior para o menor.
           *
           * O size ramp se le de cima para baixo: do confortavel ao apertado. Na grade
           * horizontal de antes o 32 e o 512 ficavam lado a lado e nenhum era o ponto de
           * partida.
           *
           * `maskRadiusPx` e `defaultMaskRadius` com o tamanho **de exibicao**, nao com o
           * `size`: o contorno precisa seguir a forma do que esta na tela. Com o raio do
           * 512 num thumb de 160px, o recorte pareceria maior do que e.
           */}
          <ol className="ic-export-preview-ramp">
            {SIZES.map(({ size, displaySize }) => {
              const t = thumbs.get(size);
              const maskRadiusPx = defaultMaskRadius(maskShape, displaySize);
              return (
                <li key={size} className="ic-export-preview-row">
                  <figure className="ic-export-preview-cell">
                    {/**
                     * O par claro/escuro dentro de **um** contorno: e o mesmo arquivo sendo
                     * julgado nos dois fundos, e o recorte da plataforma em volta dos dois.
                     * Um contorno por fundo mostraria um icone que nao existe — dois
                     * recortes sobrepostos.
                     */}
                    <div
                      className="ic-export-preview-frame"
                      data-mask={maskShape}
                      style={{
                        width: displaySize,
                        height: displaySize,
                        borderRadius: maskRadiusPx
                      }}
                    >
                      {t ? (
                        /**
                         * O mesmo arquivo nos **dois** fundos, num quadrado so: metade clara
                         * em cima, metade escura embaixo, e a imagem por cima.
                         *
                         * Antes eram dois quadrados empilhados, cada um com o seu fundo — e
                         * nao cabia um unico contorno de mascara sobre os dois. Split e o
                         * que permite um recorte, que e o ponto.
                         *
                         * O `alt` cita os dois fundos, porque e o que se ve.
                         */
                        <img
                          src={t.url}
                          alt={`${size}px on light and dark backgrounds`}
                        />
                      ) : (
                        <span className="ic-export-preview-pending">{size}px</span>
                      )}
                    </div>

                    {/**
                     * O contorno tracejado, por cima. Um `box-shadow` com spread em vez de
                     * `border`: a borda encolheria a imagem em 1px de cada lado, e quem
                     * julga "a arte tocou a borda" nao pode ter a borda mexendo no desenho.
                     */}
                    <span
                      className="ic-export-preview-mask"
                      style={{ borderRadius: maskRadiusPx }}
                      aria-hidden="true"
                    />

                    <figcaption>
                      <strong>{size}px</strong>
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ol>

          {inset && (
            <p className="ic-export-preview-warn" role="status">
              The artwork stops about <strong>{marginPct}%</strong> short of the canvas edge at
              {' '}{smallest}px — a band of background sits around it. That is the
              {' '}<strong>import margin</strong> you set in Edit Space; set it to 0 if you want the
              artwork to fill the canvas. Scaling the layer up also works.
            </p>
          )}
          {!inset && (
            <p className="ic-export-preview-note">
              The artwork reaches the canvas edge — no margin around it.
            </p>
          )}
        </>
      )}

      {audit.issues.some((i) => i.severity === 'error') && (
        <p className="ic-export-preview-warn" role="status">
          This project still has {audit.issues.filter((i) => i.severity === 'error').length}{' '}
          blocking issue(s). Fix them in Edit Space before exporting.
        </p>
      )}
    </section>
  );
};