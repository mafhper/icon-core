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
   * Artifact-model fields (ADR-014, additive). When `artifacts` is present it is
   * the persisted snapshot of the plan; otherwise the plan is derived from the
   * preset (new/legacy projects). The legacy `format`/`quality`/`structure`/`zip`
   * fields above are kept as a fallback and are never deleted.
   */
  presetId?: string;
  artifacts?: ExportArtifact[];
  /** Transport destination (zip/folder/files) — not part of the plan. */
  destination?: ExportDestination;
}

// --- export artifact model (ADR-014) ---

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
  /** Raster side length (icons are square); for `svg`, the canvas/viewBox. */
  size?: number;
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

/** Non-icon file produced by a plan (manifest, report, preview…). */
export type ExportAttachmentGenerator = 'manifest' | 'browserconfig' | 'report' | 'preview' | 'readme';

export interface ExportAttachment {
  path: string;
  generator: ExportAttachmentGenerator;
  /**
   * Whether the user still wants this file. Defaults to `true`.
   *
   * Attachments are **declared, never implicit** (ADR-014 invariant: every
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

/** A preset is a convenience generator of an initial plan (ADR-014 §2.6). */
export interface ExportPreset {
  id: string;
  label: string;
  description: string;
  platforms: ExportPlatform[];
  createArtifacts(context: ExportContext): ExportArtifactSpec[];
  recommended?: boolean;
  documentation?: string;
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

/** Derive an artifact's nature from its format (ADR-014 §1.2). */
export const kindOf = (format: ExportFormat): ExportArtifactKind => EXPORT_FORMAT_KIND[format];

/** Container formats (`ico`/`icns`) carry embedded representations. */
export const isContainerFormat = (format: ExportFormat): format is 'ico' | 'icns' =>
  EXPORT_FORMAT_KIND[format] === 'container';

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
    background: Fill;
    safeArea?: SafeArea;
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

// --- UI/UX 2026 engineering contracts (PR-04) ---
// Fixed by the redesign sprint master plan (.dev/docs/redesign-uiux-2026-plan.md, §6).
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
