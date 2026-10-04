export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export type UiTheme = 'light' | 'dark' | 'gold';

export type OutputMode = 'default' | 'themed';

export type ThemedVariant = 'default' | 'light' | 'dark';

// --- v2 types ---

export type IconVariant = 'default' | 'light' | 'dark' | 'mono' | 'highContrast' | 'transparent';

export type IconTarget =
  | 'web-favicon'
  | 'pwa'
  | 'tauri'
  | 'electron'
  | 'desktop-generic'
  | 'marketing';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export type ShapeKind = 'circle' | 'rectangle' | 'rounded-rectangle' | 'squircle' | 'polygon' | 'triangle' | 'line' | 'star';

export interface GradientStop {
  offset: number;
  color: string;
  /** 0..1 (default 1). */
  alpha?: number;
  /**
   * Stable identity for the editor (React keys). Optional and ignored by the
   * renderer; assigned by the UI so a stop keeps its row when the list reorders.
   */
  id?: string;
}

export interface SolidFill {
  kind: 'solid';
  color?: string;
  /** 0..1 (default 1). */
  alpha?: number;
}

export interface LinearGradientFill {
  kind: 'linear-gradient';
  stops?: GradientStop[];
  /** Degrees: 0 = to top, increasing clockwise (CSS/Figma convention). Default 90. */
  angle?: number;
}

export interface RadialGradientFill {
  kind: 'radial-gradient';
  stops?: GradientStop[];
  /** Radial gradient center, 0..1 of the bounds (default 0.5/0.5). */
  centerX?: number;
  centerY?: number;
  /** Radial gradient radius as a fraction of the max dimension (default 0.5). */
  radius?: number;
}

export interface AngularGradientFill {
  kind: 'angular-gradient';
  stops?: GradientStop[];
  /** Starting angle in degrees: 0 = up, increasing clockwise (default 0). */
  angle?: number;
  centerX?: number;
  centerY?: number;
}

export interface DiamondGradientFill {
  kind: 'diamond-gradient';
  stops?: GradientStop[];
  centerX?: number;
  centerY?: number;
  /** Diamond reach as a fraction of the max dimension (default 0.5). */
  radius?: number;
}

/** Absence of paint: keep the alpha channel (fully transparent). */
export interface NoneFill {
  kind: 'none';
}

export type GradientFill =
  | LinearGradientFill
  | RadialGradientFill
  | AngularGradientFill
  | DiamondGradientFill;

export type Fill = SolidFill | GradientFill | NoneFill;

export interface Stroke {
  color: string;
  width: number;
  alignment: 'center' | 'inside' | 'outside';
}

export type LayerEffectKind =
  | 'depth-shadow'
  | 'inner-lift'
  | 'edge-highlight'
  | 'soft-refraction'
  | 'surface-blur'
  | 'translucent-fill'
  | 'noise-grain'
  | 'adaptive-stroke'
  | 'mono-mapper';

export interface LayerEffect {
  kind: LayerEffectKind;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export interface SafeArea {
  inset: number;
  shape: 'circle' | 'rounded-rectangle' | 'square';
}

export interface Transform2D {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TextDefinition {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  /**
   * Horizontal alignment **inside the layer's own shape** (`source.shape`).
   *
   * Not the canvas: a `left` anchored at the canvas centre would grow the text to the
   * *right* of the middle, which is the opposite of what "left" means to the person
   * reading it. The shape has been the layer's footprint since `createTextLayer`
   * (58% of the canvas width) and is what resize already respects.
   *
   * **Additive and optional:** absent means `'center'`, which is exactly how every text
   * layer rendered before this field existed. No migration, no `schemaVersion` bump.
   */
  textAlign?: 'left' | 'center' | 'right';
  /**
   * `'italic'` slants the glyphs; anything else (including absent) is upright.
   *
   * A string rather than a boolean because a boolean cannot tell "upright" from "not
   * set". The difference is invisible in the editor and shows up in the export.
   *
   * **`oblique` foi removido do modelo.** O Agente B, ao revisar o `IC63/2`, apontou que
   * ele estava no tipo sem existir na UI — e um terceiro estado que ninguém produz
   * significa um valor a serializar, persistir, testar e exportar. Ele já entrou no
   * `.iconcore.json` de quem usou esta branch durante o desenvolvimento, então um
   * arquivo assim tem `fontStyle: "oblique"` e cai em "upright". **Remover depois não
   * seria compatível**; por isso saiu agora, e não quando aparecer a primeira UI para
   * ele. Se um dia for preciso, `oblique` volta — e a entrada será o mesmo `italic` no
   * Canvas e no SVG, que é o que a especificação do SVG exige.
   *
   * **Aditivo e opcional**, como acima.
   */
  fontStyle?: 'normal' | 'italic';
}

export interface ShapeDefinition {
  kind: ShapeKind;
  width: number;
  height: number;
  cornerRadius?: number;
  points?: Array<{ x: number; y: number }>;
  /** star: number of points (default 5) and inner/outer radius ratio (default 0.5). */
  pointCount?: number;
  innerRatio?: number;
}

export interface LayerSource {
  type: 'inline' | 'reference';
  mimeType?: string;
  data?: string;
  path?: string;
  shape?: ShapeDefinition;
}

/** Color adjustments for image/svg layers. Percentages are CSS-filter style (100 = unchanged). */
export interface ImageFilter {
  hue?: number;        // degrees, -180..180
  saturation?: number; // %, 0..200 (100 = normal)
  brightness?: number; // %, 0..200 (100 = normal)
  contrast?: number;   // %, 0..200 (100 = normal)
}

/** Build a CSS `filter` string from an ImageFilter (empty when no effective adjustment). */
export const imageFilterToCss = (filter?: ImageFilter): string => {
  if (!filter) return '';
  const parts: string[] = [];
  if (filter.hue) parts.push(`hue-rotate(${filter.hue}deg)`);
  if (filter.saturation !== undefined && filter.saturation !== 100) parts.push(`saturate(${filter.saturation}%)`);
  if (filter.brightness !== undefined && filter.brightness !== 100) parts.push(`brightness(${filter.brightness}%)`);
  if (filter.contrast !== undefined && filter.contrast !== 100) parts.push(`contrast(${filter.contrast}%)`);
  return parts.join(' ');
};

export interface IconLayer {
  id: string;
  name: string;
  kind: 'svg' | 'image' | 'shape' | 'text';
  /**
   * Structural role. `'background'` marks the selectable handle of
   * `project.canvas.background`; it never produces pixels in the renderer.
   * Identification is semantic — never rely on `name === 'Background'`.
   */
  role?: 'background';
  visible: boolean;
  locked?: boolean;
  zIndex: number;
  source: LayerSource;
  transform: Transform2D;
  opacity: number;
  blendMode?: BlendMode;
  fill?: Fill;
  stroke?: Stroke;
  effects?: LayerEffect[];
  text?: TextDefinition;
  imageFilter?: ImageFilter;
  /**
   * Recolors the paint of an imported `svg` layer, keyed by the **normalized source
   * color** (`#rrggbb`, or an opaque CSS token like `currentcolor`).
   *
   * A `kind: 'svg'` layer has no `fill` of its own: the color lives in the markup, and
   * the renderer injects the document verbatim. Setting `fill` on such a layer did
   * nothing, in both directions — the inspector offered a control and the renderer
   * never read it.
   *
   * Keyed by source color rather than by a single tint, so **multicolor artwork stays
   * multicolor**: changing the white in a two-color icon leaves the other alone.
   *
   * Optional, so every project saved before this field is still valid, untouched.
   */
  svgPaintOverrides?: Record<string, string>;
  variantOverrides?: Partial<Record<IconVariant, Partial<Omit<IconLayer, 'id' | 'role' | 'variantOverrides'>>>>;
}

export interface VariantOverrides {
  canvas?: {
    background?: Fill;
  };
  layerOverrides?: Record<string, Partial<Omit<IconLayer, 'id' | 'variantOverrides'>>>;
}

export interface TargetConfig {
  target: IconTarget;
  enabled: boolean;
  sizes?: number[];
  formats?: Array<'png' | 'ico' | 'icns' | 'svg' | 'webp'>;
  includeMaskable?: boolean;
  includeManifest?: boolean;
}

/** Raster output format for rendered icon files. */
export type OutputFormat = 'png' | 'webp' | 'jpeg';

/** Folder layout for an exported icon pack. */
export type ExportStructure = 'nested' | 'flat';

/** ZIP archive compression strategy. */
export type ZipCompression = 'store' | 'deflate';

export interface ExportProfile {
  outputBaseName: string;
  /** 0..1 encode quality, applied to lossy formats (webp/jpeg); ignored for png. */
  quality: number;
  generateReport: boolean;
  /** Raster file format. Defaults to 'png'. */
  format?: OutputFormat;
  /** Folder layout: nested `{target}/{variant}/` or flat. Defaults to 'nested'. */
  structure?: ExportStructure;
  /** Package as a single ZIP. Defaults to true (web download). */
  zip?: boolean;
  /** ZIP compression strategy. Defaults to 'deflate'. */
  compression?: ZipCompression;
  /** DEFLATE level 0..9. Defaults to 6. */
  compressionLevel?: number;
  /** Include a standalone preview.html contact sheet. Defaults to true. */
  includePreview?: boolean;
  /**
   * Artifact-model fields (additive). When `artifacts` is present it is
   * the persisted snapshot of the plan; otherwise the plan is derived from the
   * preset (new/legacy projects). The legacy `format`/`quality`/`structure`/`zip`
   * fields above are kept as a fallback and are never deleted.
   */
  presetId?: string;
  artifacts?: ExportArtifact[];
  /** Transport destination (zip/folder/files) — not part of the plan. */
  destination?: ExportDestination;
}

// --- export artifact model  ---

/** Encoding of an exported file: raster, vector or container. */
export type ExportFormat = 'svg' | 'png' | 'webp' | 'jpeg' | 'ico' | 'icns';

/** Nature of an artifact — derived from its format (never serialized). */
export type ExportArtifactKind = 'raster' | 'vector' | 'container';

/** Where an exported pack is written. Transport only — not part of the plan. */
export type ExportDestination = 'zip' | 'folder' | 'files';

/** Opacity requirement of a raster artifact (e.g. PWA maskable requires `opaque`). */
export type ExportBackground = 'transparent' | 'opaque';

/** Platform a preset targets. */
export type ExportPlatform = 'windows' | 'macos' | 'linux' | 'web';

export interface ExportArtifactSpec {
  id: string;
  format: ExportFormat;
  /** Output path, with optional tokens: `{name} {variant} {format} {size} {target}`. */
  path: string;
  enabled: boolean;
  variant?: IconVariant;
  /**
   * Output width in px. Raster artifacts compose at the canvas size and then
   * resample to this. For `svg` only the root `width`/`height` change — the
   * viewBox stays in canvas units, so the geometry matches the raster pipeline
   * instead of scaling the artwork.
   */
  size?: number;
  /**
   * Output height in px. **Additive and optional:** absent means square
   * (`height = size`), which is what every artifact was before non-square
   * existed, so an existing model resolves exactly as it always did.
   * Always read it through {@link resolveSize} — never re-derive the
   * square/non-square rule per caller.
   */
  height?: number;
  /** 0..1, applied to lossy formats (webp/jpeg) only. */
  quality?: number;
  background?: ExportBackground;
  /** Origin target, for traceability. */
  target?: IconTarget;
  options?: Record<string, unknown>;
}

/**
 * ICO/ICNS: a container of embedded raster representations. `entries` are
 * **physical** pixel sizes (the size of the embedded PNG), and are mandatory.
 */
export interface ExportContainerSpec extends Omit<ExportArtifactSpec, 'format'> {
  format: 'ico' | 'icns';
  entries: number[];
}

export type ExportArtifact = ExportArtifactSpec | ExportContainerSpec;

/** A resolved pixel dimension pair. */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * The **single** place that resolves a pixel dimension pair from the model's
 * additive shape: `size` is the width and an absent `height` means **square**
 * (`height = size`).
 *
 * That fallback is what keeps this additive and optional — every canvas and
 * every artifact predates non-square, so a model that only carries `size`
 * resolves byte-for-byte as before. Callers that need dimensions pass their
 * resolved pair down (raster and vector both); no caller re-derives the rule.
 */
export const resolveSize = (source: { size: number; height?: number }): Dimensions =>
  source.height === undefined
    ? { width: source.size, height: source.size }
    : { width: source.size, height: source.height };

/** True when a resolved pair is square. */
export const isSquareSize = (dimensions: Dimensions): boolean =>
  dimensions.width === dimensions.height;

/** Non-icon file produced by a plan (manifest, report, preview…). */
export type ExportAttachmentGenerator = 'manifest' | 'browserconfig' | 'report' | 'preview' | 'readme';

export interface ExportAttachment {
  path: string;
  generator: ExportAttachmentGenerator;
  /**
   * Whether the user still wants this file. Defaults to `true`.
   *
   * Attachments are **declared, never implicit** (every
   * produced file derives from an enabled artifact or an enabled declared
   * attachment). A companion the user cannot see is a companion they cannot
   * turn off — which is how `preview.html` and `iconcore-report.json` ended up
   * in packs that were supposed to contain nothing but an `.ico`.
   */
  enabled?: boolean;
}

/** The output plan: an editable list of artifacts plus non-icon attachments. */
export interface ExportPlan {
  presetId?: string;
  artifacts: ExportArtifact[];
  attachments: ExportAttachment[];
}

export interface ExportContext {
  project: IconCoreProject;
  variants: IconVariant[];
}

/** A preset is a convenience generator of an initial plan. */
/**
 * How a preset lays out several variants of the same artifact.
 *
 * `shared` (the default, and every preset before this field existed): every
 * variant of an artifact resolves to the **same** path. That is correct for a
 * platform contract — `tauri.conf.json` wants `icons/32x32.png` at exactly that
 * path and there is nothing to negotiate — and wrong for anything a human or a
 * browser consumes by URL, because the variants overwrite each other.
 *
 * `per-folder`: `default` keeps the declared path and every other variant goes
 * under a `<variant>/` folder, so they coexist.
 */
export type VariantLayout = 'shared' | 'per-folder';

export interface ExportPreset {
  id: string;
  label: string;
  description: string;
  platforms: ExportPlatform[];
  createArtifacts(context: ExportContext): ExportArtifactSpec[];
  recommended?: boolean;
  documentation?: string;
  /**
   * Defaults to `shared`. A preset that ships web-consumable assets (favicons,
   * PWA icons, marketing art) should declare `per-folder`; anything whose paths
   * are read by a build tool should leave it alone.
   */
  variantLayout?: VariantLayout;
}

export const EXPORT_FORMAT_KIND: Record<ExportFormat, ExportArtifactKind> = {
  svg: 'vector',
  png: 'raster',
  webp: 'raster',
  jpeg: 'raster',
  ico: 'container',
  icns: 'container'
};

/** File extension per format (`jpeg` uses `jpg`). */
export const EXPORT_FORMAT_EXTENSION: Record<ExportFormat, string> = {
  svg: 'svg',
  png: 'png',
  webp: 'webp',
  jpeg: 'jpg',
  ico: 'ico',
  icns: 'icns'
};

export const EXPORT_FORMAT_MIME: Record<ExportFormat, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  icns: 'image/icns'
};

/** Derive an artifact's nature from its format. */
export const kindOf = (format: ExportFormat): ExportArtifactKind => EXPORT_FORMAT_KIND[format];

/** Container formats (`ico`/`icns`) carry embedded representations. */
export const isContainerFormat = (format: ExportFormat): format is 'ico' | 'icns' =>
  EXPORT_FORMAT_KIND[format] === 'container';

/** The shapes the canvas frame can take. */
export type CanvasMaskShape = 'square' | 'circle' | 'rounded-rectangle' | 'squircle';

/**
 * The frame radius a canvas shows when it does not declare one.
 *
 * `squircle` uses the iOS superellipse value (22.37% of the side) because that
 * is what the shape approximates — `KeylineOverlay` already draws its guide at
 * exactly this ratio, so the two agree instead of drifting apart. The other two
 * are the values the editor had hard-coded before the radius became
 * controllable.
 */
export const defaultMaskRadius = (shape: CanvasMaskShape, size: number): number => {
  switch (shape) {
    case 'circle':
      // A circle's corner radius is half the side; the frame uses `50%`.
      return size / 2;
    case 'squircle':
      return size * 0.2237;
    case 'rounded-rectangle':
      return 24;
    case 'square':
      return 4;
  }
};

/**
 * The corner radius a canvas actually uses.
 *
 * The declared `maskRadius` wins; absent means the shape's own default. This is
 * the **one** resolver, shared by the editor frame and the export mask, which is
 * what makes "what I see is what I export" true rather than approximate.
 */
export const resolveMaskRadius = (canvas: {
  size: number;
  height?: number;
  maskRadius?: number;
  maskShape?: CanvasMaskShape;
}): number => {
  const { width, height } = resolveSize(canvas);
  if (canvas.maskRadius !== undefined) return canvas.maskRadius;
  // The shape defaults are written for a square, so take the larger side for a
  // non-square canvas rather than letting a 1200x630 pick the short side.
  return defaultMaskRadius(canvas.maskShape ?? 'rounded-rectangle', Math.max(width, height));
};

/** Only `jpeg` lacks an alpha channel. */
export const supportsAlpha = (format: ExportFormat): boolean => format !== 'jpeg';

/** Lossy formats accept an encode `quality`. */
export const isLossyFormat = (format: ExportFormat): boolean => format === 'webp' || format === 'jpeg';

/** File extension for a format (`jpeg` → `jpg`). */
export const extensionForFormat = (format: ExportFormat): string => EXPORT_FORMAT_EXTENSION[format];

/** Narrow an artifact to its container spec. */
export const isContainerSpec = (artifact: ExportArtifact): artifact is ExportContainerSpec =>
  isContainerFormat(artifact.format);

export interface IconCoreProject {
  schemaVersion: 3;
  metadata: {
    name: string;
    shortName: string;
    description?: string;
    author?: string;
  };
  canvas: {
    size: number;
    /**
     * Canvas height in px. **Additive and optional:** absent means square
     * (`height = size`) — the same contract as {@link ExportArtifactSpec.height}.
     * No `schemaVersion` bump and no migration: an older document simply has
     * no `height`.
     */
    height?: number;
    background: Fill;
    safeArea?: SafeArea;
    /**
     * Margin left around a freshly imported asset, as a fraction of the canvas
     * (0 = the artwork fills the canvas). Optional; absent means 0, so no
     * migration is needed. Distinct from `safeArea`, which is a preview guide
     * and never clips the export.
     */
    importMargin?: number;
    /**
     * Corner radius of the canvas frame, in px. **Additive and optional:**
     * absent means the shape's own default (see `defaultMaskRadius`), which is
     * what every project looked like before the radius was controllable — so an
     * older document renders exactly as it always did. No migration, no
     * `schemaVersion` bump.
     *
     * Distinct from `safeArea`, which is a guide. This one is the visible edge
     * of the work area: it rounds the frame in the editor and nothing else,
     * because the export is full-bleed by design (the platform applies its own
     * mask at display time).
     */
    maskRadius?: number;
    /**
     * The shape of the canvas frame. **Additive and optional:** absent means
     * `'rounded-rectangle'`, which is what the editor's initial state has always
     * been, so an older document renders exactly as it did. No migration, no
     * `schemaVersion` bump.
     *
     * This used to live only in the editor's UI state, which is why the export
     * could not mirror what the canvas shows: a shape chosen but not saved was
     * invisible to anything that read the document. With the shape and the radius
     * both on the canvas, "what I see is what I export" becomes a fact rather
     * than a hope.
     */
    maskShape?: CanvasMaskShape;
  };
  layers: IconLayer[];
  variants: Partial<Record<IconVariant, VariantOverrides>>;
  targets: TargetConfig[];
  exportProfile: ExportProfile;
}

// --- v1 types (unchanged) ---

export interface ProjectConfig {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  defaultTheme: 'light' | 'dark';
}

export const ICONCORE_REQUEST = 'ICONCORE_REQUEST';
export const ICONCORE_RESPONSE = 'ICONCORE_RESPONSE';

export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en-US', 'es-ES'];

export const BRAND_NAME = 'IconCore';

export const BRAND_COLORS = {
  dark: '#0f1115',
  surface: '#15181e',
  border: '#23262d',
  accent: '#4da3ff'
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  name: 'IconCore App',
  shortName: 'IconCore',
  description: 'Vector asset engine for modern web projects',
  startUrl: '/',
  defaultTheme: 'light'
};

export const detectLocale = (input?: string): Locale => {
  const candidate = (input ?? '').toLowerCase();
  if (candidate.startsWith('es')) return 'es-ES';
  if (candidate.startsWith('en')) return 'en-US';
  if (candidate.startsWith('pt')) return 'pt-BR';
  return 'en-US';
};

// --- UI/UX 2026 engineering contracts ---
// These types are the compilation-time surface of the editor + library contracts;
// implementations land incrementally (path parser/editor, iconcore-library, reducer
// integration) without changing existing behavior.

// --- 6.1 State boundaries ---

/**
 * Contract: every editor field belongs to exactly one state section.
 * - persistent: saved in `.iconcore.json` (document + project metadata).
 * - transient: never enters history, dies with the gesture (drag, preview, hover).
 * - ui: localStorage only, never part of the document (theme, panels, tool, zoom, …).
 */
export type StateSection = 'persistent' | 'transient' | 'ui';

export const PERSISTENT_FIELDS = [
  'document',
  'projectMetadata',
  'layers',
  'variants',
  'canvasSize',
  'themeOverrides'
] as const;

export const TRANSIENT_FIELDS = [
  'dragging',
  'previewTransform',
  'hoveredPath',
  'hoveredLayer'
] as const;

export const UI_FIELDS = [
  'theme',
  'panelWidths',
  'activePanel',
  'libraryQuery',
  'libraryFilter',
  'inspectorSections',
  'activeTool',
  'zoom',
  'pan'
] as const;

export const stateSection = (field: string): StateSection | null => {
  if ((PERSISTENT_FIELDS as readonly string[]).includes(field)) return 'persistent';
  if ((TRANSIENT_FIELDS as readonly string[]).includes(field)) return 'transient';
  if ((UI_FIELDS as readonly string[]).includes(field)) return 'ui';
  return null;
};

// --- 6.2 InteractionTransaction ---

export type InteractionPhase = 'begin' | 'preview' | 'commit' | 'cancel';

export interface InteractionTransactionHooks<TInput, TPreview, TCommit> {
  /** Runs once when `begin` is called. Optional. */
  onBegin?: (input: TInput) => void;
  /** Runs on every `preview` with the transformed input. Optional. */
  onPreview?: (input: TInput, preview: TPreview) => void;
  /**
   * Contract: `commit` invokes `onCommit` **exactly once** per gesture and
   * returns a single semantic history operation (MoveLayer, ResizeLayer, …).
   * `preview` never commits; `cancel` discards.
   */
  onCommit: (input: TInput) => TCommit;
}

/**
 * begin(preview) → [preview(RAF)] → commit
 *
 * One gesture = one semantic operation in history. Consumed by move, resize,
 * rotate, scrub, path editing and continuous color/opacity/stroke input.
 */
export class InteractionTransaction<TInput, TPreview, TCommit> {
  private active = false;
  private committed = false;
  private input!: TInput;
  private readonly hooks: InteractionTransactionHooks<TInput, TPreview, TCommit>;

  constructor(hooks: InteractionTransactionHooks<TInput, TPreview, TCommit>) {
    this.hooks = hooks;
  }

  get isActive(): boolean {
    return this.active;
  }

  begin(input: TInput): void {
    if (this.active) return;
    this.active = true;
    this.committed = false;
    this.input = input;
    this.hooks.onBegin?.(input);
  }

  preview(transform: (input: TInput) => TPreview): void {
    if (!this.active) return;
    const preview = transform(this.input);
    this.hooks.onPreview?.(this.input, preview);
  }

  /** Invokes `onCommit` exactly once per gesture. Returns null when inactive. */
  commit(): TCommit | null {
    if (!this.active || this.committed) return null;
    this.committed = true;
    this.active = false;
    return this.hooks.onCommit(this.input);
  }

  cancel(): void {
    this.active = false;
    this.committed = false;
  }
}

// --- 6.3 Path Editor MVP contract ---

/**
 * SVG string → parser → normalized PathCommand[] → editor → serializer → SVG.
 * Supported: M / L / C / Q / Z. Normalization: H / V → L (T / S as the parser
 * requires). Never edit `d` as a string. Accept by geometric equivalence.
 */
export type PathCommand =
  | MoveCommand
  | LineCommand
  | CubicCommand
  | QuadraticCommand
  | CloseCommand;

export interface MoveCommand { type: 'M'; x: number; y: number }
export interface LineCommand { type: 'L'; x: number; y: number }
export interface CubicCommand { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
export interface QuadraticCommand { type: 'Q'; x1: number; y1: number; x: number; y: number }
export interface CloseCommand { type: 'Z' }

export type PathData = PathCommand[];

/** Semantic history operations produced by one InteractionTransaction commit. */
export type HistoryableOperation =
  | { kind: 'MoveLayer' }
  | { kind: 'ResizeLayer' }
  | { kind: 'RotateLayer' }
  | { kind: 'EditPath' }
  | { kind: 'ChangeFill' }
  | { kind: 'ChangeStroke' };

// --- 6.4 Library API contract ---

export type IconCategory = string;
export type IconVariantId = 'normal' | 'duotone' | 'fill' | 'brand' | 'color';

export interface LibraryQuery {
  query?: string;
  category?: IconCategory;
  variant?: IconVariantId;
  limit?: number;
}

export interface LibraryIcon {
  id: string;
  name: string;
  category: IconCategory;
  tags: string[];
  /** Serialized SVG source (unmodified on ingestion). */
  data: string;
  variants: IconVariantId[];
}

/**
 * IconCore library is a domain/data-only API: search, read, filter. Editorial
 * operations (insert/replace/detach) belong to the Composer via commands.
 */
export interface IconLibrary {
  searchIcons(query: LibraryQuery): Promise<LibraryIcon[]>;
  getIcon(id: string): Promise<LibraryIcon | undefined>;
  getIconsByCategory(category: IconCategory): Promise<LibraryIcon[]>;
  getIconVariants(id: string): Promise<IconVariantId[]>;
}
