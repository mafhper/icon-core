/**
 * Tracing presets.
 *
 * These are not guesses and they are not named after the vendor's presets —
 * they are the settings that were **measured** on this repo's own icons, and
 * the numbers they were chosen for are in the comment next to each one.
 *
 * Why a small curated set instead of exposing `colorPrecision` as a slider:
 * `colorPrecision` is a cliff, not a dial. Measured on `icon-512x512.png`,
 * step 6 → 4 was fine (37 paths → 3) but step 4 → 3 collapsed the logo into two
 * tones, dropping pixel agreement from 66,3% to 34,9%. A linear slider would
 * hand the user values that destroy the artwork without saying so, which is
 * the opposite of the practice the reference tool follows by publishing the
 * logo its tracer got wrong.
 */

/** Settings the tracer requires in full — a partial object is rejected. */
interface TracerConfig {
  colorMode: number;
  hierarchical: number;
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  mode: number;
  cornerThreshold: number;
  lengthThreshold: number;
  maxIterations: number;
  spliceThreshold: number;
}

export type TracePresetId = 'editable' | 'balanced' | 'faithful';

export interface TracePreset {
  id: TracePresetId;
  label: string;
  /** One line the UI can show as the trade-off, not a promise of quality. */
  tradeoff: string;
  config: TracerConfig;
}

/**
 * Enum values mirrored from `@neplex/vectorizer`'s WASI bindings. They are
 * hard-coded rather than imported so that reading this file does not pull the
 * tracer's WASI module into the process.
 */
const ColorMode = { Color: 0, Binary: 1 } as const;
const Hierarchical = { Stacked: 0, Cutout: 1 } as const;
const PathSimplifyMode = { None: 0, Polygon: 1, Spline: 2 } as const;

const base = (over: Partial<TracerConfig>): TracerConfig => ({
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  filterSpeckle: 4,
  colorPrecision: 6,
  layerDifference: 5,
  mode: PathSimplifyMode.Spline,
  cornerThreshold: 60,
  lengthThreshold: 5,
  maxIterations: 2,
  spliceThreshold: 45,
  ...over
});

export const TRACE_PRESETS: Record<TracePresetId, TracePreset> = {
  editable: {
    id: 'editable',
    label: 'Poucas cores',
    tradeoff: 'Fica editável, com alguma perda de detalhe fino.',
    // 3 paths / 3 cores, 66,3% de concordância. O passo seguinte (cp3) é onde
    // o desenho quebra, então este é o piso seguro.
    config: base({ colorPrecision: 4 })
  },
  balanced: {
    id: 'balanced',
    label: 'Equilibrado',
    tradeoff: 'Mais fidelidade, ainda agrupado em poucas regiões.',
    // 37 paths / 37 cores, 65,8% — mais caminhos que `editable` e, medido no
    // mesmo ícone, a mesma concordância. Mantido porque em arte com mais
    // formas ele preserva mais do que `editable`.
    config: base({ colorPrecision: 6 })
  },
  faithful: {
    id: 'faithful',
    label: 'Fiel',
    tradeoff: 'Uma cor por região: o mais parecido, e o menos prático de editar.',
    // 80 paths / 74 cores, 78,6% — a melhor concordância medida, ao custo de
    // transformar cada região num path.
    config: base({ colorPrecision: 8, layerDifference: 6 })
  }
};

export const DEFAULT_TRACE_PRESET: TracePresetId = 'editable';

export const isTracePresetId = (value: unknown): value is TracePresetId =>
  typeof value === 'string' && Object.hasOwn(TRACE_PRESETS, value);
