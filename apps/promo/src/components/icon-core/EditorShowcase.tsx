import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode
} from 'react';

import { useDetectedOS } from '../../hooks/use-os';
import { APPEARANCES, radiusToPx, type Appearance } from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { exportFormats, siteConfig } from '../../lib/site-config';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import { AppearanceDock, RadiusControl } from './controls';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  CursorIcon,
  DashedSquareIcon,
  EyeIcon,
  EyeOffIcon,
  FrameIcon,
  GridIcon,
  HandIcon,
  LockIcon,
  MaximizeIcon,
  MinusIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PackageIcon,
  PlusIcon,
  RedoIcon,
  ScanIcon,
  SlidersIcon,
  SquareIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon
} from './editor-icons';
import { GetItStrip, type WindowFrame } from './GetItStrip';
import { LayersIcon } from './icons';
import { IconGlyph, type GlyphLayers } from './IconArt';
import { OsIcon } from './os-icons';
import { useStudio } from './studio-context';

type Focus = 'workspace' | 'assets' | 'background' | 'keylines' | 'export' | null;

const FEATURES: { id: Exclude<Focus, null>; icon: ComponentType<{ className?: string }>; title: string; text: string }[] = [
  {
    id: 'workspace',
    icon: FrameIcon,
    title: 'Área de trabalho',
    text: 'Canvas limpo, cor da área ajustável e dock de aparências logo abaixo do ícone.'
  },
  {
    id: 'assets',
    icon: LayersIcon,
    title: 'Camadas de assets',
    text: 'Cada vetor numa camada: mostrar, travar, duplicar e apagar.'
  },
  {
    id: 'background',
    icon: SquareIcon,
    title: 'Camada de fundo',
    text: 'O fundo é uma camada própria, separada do logo.'
  },
  {
    id: 'keylines',
    icon: ScanIcon,
    title: 'Keylines e grade',
    text: 'Guias de círculo, quadrado e margem para alinhar no padrão das plataformas.'
  },
  {
    id: 'export',
    icon: PackageIcon,
    title: 'Exportação',
    text: '.ico, .icns, .png, .svg e .webp a partir do mesmo arquivo.'
  }
];

/**
 * The window's layer list is mock data with a real history: the chrome promises undo, redo,
 * duplicate and delete, so those four buttons edit this list instead of pretending to. The
 * reducer keeps the snapshots; the canvas reads the visible kinds out of it.
 */
type LayerKind = keyof GlyphLayers;

type EditorLayer = {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  locked: boolean;
};

const LAYER_LABELS: Record<LayerKind, string> = {
  petals: 'Pétalas',
  core: 'Núcleo',
  background: 'Fundo'
};

const INITIAL_LAYERS: EditorLayer[] = [
  { id: 'layer-petals', kind: 'petals', name: LAYER_LABELS.petals, visible: true, locked: false },
  { id: 'layer-core', kind: 'core', name: LAYER_LABELS.core, visible: true, locked: false },
  { id: 'layer-background', kind: 'background', name: LAYER_LABELS.background, visible: true, locked: false }
];

type MockEditorState = {
  layers: EditorLayer[];
  past: EditorLayer[][];
  future: EditorLayer[][];
  /** Monotonic id source: a copy keeps a unique key after its siblings are deleted. */
  nextId: number;
};

const INITIAL_EDITOR_STATE: MockEditorState = {
  layers: INITIAL_LAYERS,
  past: [],
  future: [],
  nextId: 1
};

type MockEditorAction =
  | { type: 'add' }
  | { type: 'toggleVisible'; id: string }
  | { type: 'toggleLock'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'undo' }
  | { type: 'redo' };

/**
 * Undo depth, and therefore what the window holds in memory. A demo that can be edited
 * forever would keep every snapshot of the session; 50 steps is more than anyone walks
 * back in a page they are trying, and it is the documented ceiling of this history.
 */
const HISTORY_LIMIT = 50;

/** Every edit goes through here, which is what makes undo and redo possible at all. */
const withHistory = (state: MockEditorState, layers: EditorLayer[]): MockEditorState => ({
  ...state,
  layers,
  past: [...state.past, state.layers].slice(-HISTORY_LIMIT),
  future: []
});

/** `Pétalas 2`, `Pétalas 3`… never reusing a name that is still on screen. */
function copyName(layers: EditorLayer[], kind: LayerKind): string {
  const base = LAYER_LABELS[kind];
  let index = 2;

  while (layers.some((layer) => layer.name === `${base} ${index}`)) index += 1;

  return `${base} ${index}`;
}

/** `Camada 1`, `Camada 2`… the first number no layer on screen is using. */
function addedLayerName(layers: EditorLayer[]): string {
  let index = 1;

  while (layers.some((layer) => layer.name === `Camada ${index}`)) index += 1;

  return `Camada ${index}`;
}

function mockEditorReducer(state: MockEditorState, action: MockEditorAction): MockEditorState {
  switch (action.type) {
    case 'add': {
      // The demo has no import dialog, so a new layer starts as a petals vector with the
      // same paint as the logo; the name is what makes it a distinct row.
      const layer: EditorLayer = {
        id: `layer-${state.nextId}`,
        kind: 'petals',
        name: addedLayerName(state.layers),
        visible: true,
        locked: false
      };

      return {
        ...withHistory(state, [layer, ...state.layers]),
        nextId: state.nextId + 1
      };
    }

    case 'toggleVisible':
      return withHistory(
        state,
        state.layers.map((layer) => (layer.id === action.id ? { ...layer, visible: !layer.visible } : layer))
      );

    case 'toggleLock':
      return withHistory(
        state,
        state.layers.map((layer) => (layer.id === action.id ? { ...layer, locked: !layer.locked } : layer))
      );

    case 'duplicate': {
      const index = state.layers.findIndex((layer) => layer.id === action.id);
      const source = state.layers[index];
      if (!source) return state;

      const copy: EditorLayer = { ...source, id: `layer-${state.nextId}`, name: copyName(state.layers, source.kind) };

      return {
        ...withHistory(state, [...state.layers.slice(0, index + 1), copy, ...state.layers.slice(index + 1)]),
        nextId: state.nextId + 1
      };
    }

    case 'remove':
      return withHistory(
        state,
        state.layers.filter((layer) => layer.id !== action.id)
      );

    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;

      return { ...state, layers: previous, past: state.past.slice(0, -1), future: [state.layers, ...state.future] };
    }

    case 'redo': {
      const next = state.future[0];
      if (!next) return state;

      return { ...state, layers: next, past: [...state.past, state.layers], future: state.future.slice(1) };
    }
  }
}

/**
 * The editor as a working window, not a screenshot. Tabs swap the properties panel, the
 * keyline switch draws the guides over the icon, and the radius control is the same one
 * from the hero — moving it here moves the icon everywhere on the page.
 */
export function EditorShowcase() {
  const [focus, setFocus] = useState<Focus>(null);
  const [tab, setTab] = useState<'design' | 'export'>('design');
  const [keyline, setKeyline] = useState(false);
  const [grid, setGrid] = useState(false);
  const [frame, setFrame] = useState<WindowFrame>('web');

  const choose = (id: Exclude<Focus, null>) => {
    setFocus((current) => (current === id ? null : id));
    if (id === 'export') setTab('export');
    if (id === 'keylines') {
      setTab('design');
      setKeyline(true);
    }
    if (id === 'workspace' || id === 'assets' || id === 'background') setTab('design');
  };

  return (
    <section id="interface" className="scroll-mt-20 border-y bg-muted/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">
            Nova interface · v{siteConfig.version}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Um editor de ícones de verdade, no navegador e no desktop.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Esta janela funciona: ligue camadas, ative as keylines, mude o raio e prepare a exportação.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[17rem_1fr]">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
            {FEATURES.map((feature) => {
              const active = focus === feature.id;
              return (
                <li key={feature.id}>
                  <button
                    type="button"
                    onClick={() => choose(feature.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full cursor-pointer gap-3 rounded-2xl border border-transparent p-3.5 text-left transition-all hover:bg-card',
                      active && 'border-border bg-card shadow-float'
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground transition-colors',
                        active && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <feature.icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{feature.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {feature.text}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            <EditorWindow
              focus={focus}
              tab={tab}
              setTab={setTab}
              keyline={keyline}
              setKeyline={setKeyline}
              grid={grid}
              setGrid={setGrid}
              frame={frame}
              setFrame={setFrame}
            />
            <GetItStrip frame={frame} onFrameChange={setFrame} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Highlight({
  on,
  label,
  className,
  children
}: {
  on: boolean;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative transition-shadow duration-300', on && 'z-10 ring-2 ring-primary ring-inset', className)}>
      {children}
      <span
        className={cn(
          'pointer-events-none absolute top-2 right-2 rounded-md bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground transition-opacity',
          on ? 'opacity-100' : 'opacity-0'
        )}
      >
        {label}
      </span>
    </div>
  );
}

type WindowProps = {
  focus: Focus;
  tab: 'design' | 'export';
  setTab: (tab: 'design' | 'export') => void;
  keyline: boolean;
  setKeyline: (value: boolean) => void;
  grid: boolean;
  setGrid: (value: boolean) => void;
  frame: WindowFrame;
  setFrame: (frame: WindowFrame) => void;
};

function EditorWindow({ focus, tab, setTab, keyline, setKeyline, grid, setGrid, frame, setFrame }: WindowProps) {
  const { appearance, radius } = useStudio();
  const detected = useDetectedOS();
  const os = detected === 'macos' || detected === 'linux' ? detected : 'windows';
  const [editor, dispatch] = useReducer(mockEditorReducer, INITIAL_EDITOR_STATE);
  const [tool, setTool] = useState<'select' | 'move'>('select');
  const [panels, setPanels] = useState({ layers: true, properties: true });
  const [margin, setMargin] = useState(0);
  const [showMargin, setShowMargin] = useState(true);
  const [zoom, setZoom] = useState(100);
  const appearanceLabel = APPEARANCES.find((item) => item.id === appearance)?.label ?? 'Default';

  const glyphLayers: GlyphLayers = {
    background: editor.layers.some((layer) => layer.kind === 'background' && layer.visible),
    petals: editor.layers.some((layer) => layer.kind === 'petals' && layer.visible),
    core: editor.layers.some((layer) => layer.kind === 'core' && layer.visible)
  };
  const assetLayers = editor.layers.filter((layer) => layer.kind !== 'background');
  const backgroundLayers = editor.layers.filter((layer) => layer.kind === 'background');
  const canUndo = editor.past.length > 0;
  const canRedo = editor.future.length > 0;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Moldura da janela" className="inline-flex rounded-full border bg-card p-1 text-xs">
          {(
            [
              ['web', 'Navegador'],
              ['desktop', 'Desktop']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={frame === id}
              onClick={() => setFrame(id)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
                frame === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {id === 'desktop' && <OsIcon os={os} className="size-3" />}
              {label}
            </button>
          ))}
        </div>
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          {frame === 'web'
            ? 'mafhper.github.io/icon-core/app/'
            : `App Tauri · ${os === 'macos' ? 'macOS' : os === 'linux' ? 'Linux' : 'Windows'}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-window">
        <WindowChrome frame={frame} os={os} />

        <div className="flex h-10 items-center gap-4 border-b px-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="grid size-4 place-items-center rounded-sm bg-foreground text-background">
              <span className="text-[9px] leading-none font-bold">I</span>
            </span>
            Icon-Core
            <span className="rounded border px-1 font-mono text-[9px] font-normal text-muted-foreground">
              {siteConfig.stage}
            </span>
          </span>
          {/*
            Illustration, not controls: the menu bar and the breadcrumb are part of the
            window's picture. They carry no handler and stay out of the accessibility tree,
            because a menu that opens nothing would be a worse promise than a drawing of one.
          */}
          <span aria-hidden className="hidden gap-3 text-muted-foreground sm:flex">
            <span>Arquivo</span>
            <span>Editar</span>
            <span>Exibir</span>
            <span>Sobre</span>
          </span>
          <span aria-hidden className="ml-auto hidden items-center gap-1 text-muted-foreground md:flex">
            <PackageIcon className="size-3" /> circle-logo <ChevronRightIcon className="size-3" /> {appearanceLabel}
          </span>
          <span className="md:ml-auto md:hidden" />
        </div>

        <div
          className={cn(
            'grid',
            panels.layers && panels.properties && 'md:grid-cols-[13rem_1fr_15rem]',
            panels.layers && !panels.properties && 'md:grid-cols-[13rem_1fr]',
            !panels.layers && panels.properties && 'md:grid-cols-[1fr_15rem]',
            !panels.layers && !panels.properties && 'md:grid-cols-1'
          )}
        >
          <aside
            data-testid="editor-layers-panel"
            hidden={!panels.layers}
            className="order-2 border-t md:order-1 md:border-r md:border-t-0"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-sm font-semibold">circle-logo</span>
            </div>
            <div className="flex items-center justify-between px-3 pb-2 text-xs text-muted-foreground">
              <span>Camadas {editor.layers.length}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'add' })}
                title="Adicionar camada"
                aria-label="Adicionar camada"
                className="-m-0.5 cursor-pointer rounded p-0.5 hover:text-foreground"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
            <Highlight on={focus === 'assets'} label="assets">
              <LayerGroup title="Camadas de assets" count={assetLayers.length}>
                {assetLayers.map((layer) => (
                  <LayerRow
                    key={layer.id}
                    name={layer.name}
                    thumb={<LayerThumb appearance={appearance} kind={layer.kind} />}
                    visible={layer.visible}
                    onToggle={() => dispatch({ type: 'toggleVisible', id: layer.id })}
                    locked={layer.locked}
                    onLock={() => dispatch({ type: 'toggleLock', id: layer.id })}
                    onDuplicate={() => dispatch({ type: 'duplicate', id: layer.id })}
                    onRemove={() => dispatch({ type: 'remove', id: layer.id })}
                  />
                ))}
              </LayerGroup>
            </Highlight>
            <Highlight on={focus === 'background'} label="fundo">
              <LayerGroup title="Camada de fundo" count={backgroundLayers.length}>
                {backgroundLayers.map((layer) => (
                  <LayerRow
                    key={layer.id}
                    name={layer.name}
                    thumb={<LayerThumb appearance={appearance} kind={layer.kind} />}
                    visible={layer.visible}
                    onToggle={() => dispatch({ type: 'toggleVisible', id: layer.id })}
                    locked={layer.locked}
                    onLock={() => dispatch({ type: 'toggleLock', id: layer.id })}
                    onDuplicate={() => dispatch({ type: 'duplicate', id: layer.id })}
                    onRemove={() => dispatch({ type: 'remove', id: layer.id })}
                  />
                ))}
              </LayerGroup>
            </Highlight>
          </aside>

          <Highlight on={focus === 'workspace'} label="área de trabalho" className="order-1 md:order-2">
            <div className="flex h-10 items-center gap-1 border-b px-2 text-muted-foreground">
              <ToolButton
                icon={PanelLeftIcon}
                label="Painel de camadas"
                active={panels.layers}
                onClick={() => setPanels((value) => ({ ...value, layers: !value.layers }))}
              />
              <span className="mx-1 h-4 w-px bg-border" />
              <ToolButton
                icon={UndoIcon}
                label="Desfazer"
                disabled={!canUndo}
                onClick={() => dispatch({ type: 'undo' })}
              />
              <ToolButton
                icon={RedoIcon}
                label="Refazer"
                disabled={!canRedo}
                onClick={() => dispatch({ type: 'redo' })}
              />
              <span className="mx-1 h-4 w-px bg-border" />
              <DisplayOptionsMenu keyline={keyline} onKeyline={setKeyline} grid={grid} onGrid={setGrid} />
              <span className="ml-auto" />
              <ToolButton
                icon={PanelRightIcon}
                label="Painel de propriedades"
                active={panels.properties}
                onClick={() => setPanels((value) => ({ ...value, properties: !value.properties }))}
              />
            </div>
            <div
              className={cn(
                'relative flex min-h-[420px] flex-col items-center justify-center gap-5 bg-canvas px-4 py-8 transition-colors',
                grid && 'ic-grid-bg'
              )}
            >
              {/*
                Zero layers used to leave a blank canvas. The empty state names the state and
                points at the control that ends it, so the window never reads as broken.
              */}
              {editor.layers.length === 0 ? (
                <div
                  data-testid="editor-empty-state"
                  className="grid place-items-center gap-1 rounded-xl border border-dashed px-4 text-center"
                  style={{ width: 'min(56vw, 260px)', height: 'min(56vw, 260px)' }}
                >
                  <p className="text-xs font-medium">Nenhuma camada</p>
                  <p className="text-[11px] text-muted-foreground">Use o + em Camadas para adicionar.</p>
                </div>
              ) : (
                <div
                  className="relative transition-transform duration-300"
                  style={{ width: 'min(56vw, 260px)', height: 'min(56vw, 260px)', transform: `scale(${zoom / 100})` }}
                >
                  <div className="h-full w-full drop-shadow-2xl">
                    <IconGlyph
                      appearance={appearance}
                      radii={radius}
                      size="100%"
                      layers={glyphLayers}
                      margin={margin}
                      label="Ícone no editor"
                      animated
                    />
                  </div>
                  {!glyphLayers.background && (
                    <div
                      aria-hidden
                      className="ic-grid-bg pointer-events-none absolute inset-0 -z-10 opacity-60"
                      style={{ borderRadius: `${radius}%` }}
                    />
                  )}
                  {showMargin && margin > 0 && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute border border-dashed border-primary/70"
                      style={{ inset: `${margin / 2}%` }}
                    />
                  )}
                  {keyline && <KeylineGuides />}
                </div>
              )}
              <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-1 rounded-full bg-muted-foreground" /> sRGB · 512 × 512 px · {appearanceLabel}{' '}
                appearance
              </p>
              <AppearanceDock size={34} className="w-full max-w-xs" />
              <div className="flex items-center gap-0.5 rounded-xl border bg-card px-1.5 py-1 text-muted-foreground shadow-float">
                <ToolButton
                  icon={CursorIcon}
                  label="Selecionar"
                  active={tool === 'select'}
                  onClick={() => setTool('select')}
                />
                <ToolButton icon={HandIcon} label="Mover" active={tool === 'move'} onClick={() => setTool('move')} />
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolButton icon={GridIcon} label="Grade" active={grid} onClick={() => setGrid(!grid)} />
                <ToolButton
                  icon={DashedSquareIcon}
                  label="Keylines"
                  active={keyline}
                  onClick={() => setKeyline(!keyline)}
                />
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolButton
                  icon={MinusIcon}
                  label="Diminuir zoom"
                  onClick={() => setZoom((value) => Math.max(60, value - 10))}
                />
                <span className="w-10 text-center font-mono text-[10px]">{zoom}%</span>
                <ToolButton
                  icon={PlusIcon}
                  label="Aumentar zoom"
                  onClick={() => setZoom((value) => Math.min(120, value + 10))}
                />
                <ToolButton icon={MaximizeIcon} label="Ajustar" onClick={() => setZoom(100)} />
              </div>
            </div>
          </Highlight>

          <aside
            data-testid="editor-properties-panel"
            hidden={!panels.properties}
            className="order-3 border-t md:border-t-0 md:border-l"
          >
            <div role="tablist" aria-label="Painel do editor" className="flex gap-4 border-b px-4 text-xs">
              {(
                [
                  ['design', 'Design'],
                  ['export', 'Export']
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`editor-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`editor-panel-${id}`}
                  onClick={() => setTab(id)}
                  className={cn(
                    '-mb-px cursor-pointer border-b-2 border-transparent py-2.5 transition-colors',
                    tab === id ? 'border-primary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'design' ? (
              <div
                role="tabpanel"
                id="editor-panel-design"
                aria-labelledby="editor-tab-design"
                className="divide-y text-xs"
              >
                <Panel title="Área de trabalho">
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 font-mono text-[11px]">
                    <span className="size-3 rounded-sm border bg-canvas" /> canvas
                    {/* The zoom readout follows the toolbar, not a fixed 100 %. */}
                    <span data-testid="canvas-zoom" className="ml-auto text-muted-foreground">
                      {zoom}%
                    </span>
                  </div>
                </Panel>
                <Panel title="Margem de importação">
                  <Slider
                    id="import-margin"
                    aria-label="Margem de importação"
                    min={0}
                    max={30}
                    step={1}
                    value={margin}
                    onValueChange={setMargin}
                    formatValue={(value) => `${value}%`}
                  />
                  <Row label="Mostrar margem no canvas">
                    <Switch checked={showMargin} onCheckedChange={setShowMargin} aria-label="Mostrar margem" />
                  </Row>
                </Panel>
                <Panel title="Grade">
                  <Row label="Mostrar grade">
                    <Switch checked={grid} onCheckedChange={setGrid} aria-label="Mostrar grade" />
                  </Row>
                </Panel>
                <Highlight on={focus === 'keylines'} label="keylines">
                  <Panel title="Keyline">
                    <Row label="Mostrar keyline">
                      <Switch checked={keyline} onCheckedChange={setKeyline} aria-label="Mostrar keyline" />
                    </Row>
                  </Panel>
                </Highlight>
                <Panel title="Moldura">
                  <RadiusControl id="editor-frame-radius" />
                  <p className="text-[11px] text-muted-foreground">
                    O mesmo raio do ícone no topo da página ({radiusToPx(radius)} px).
                  </p>
                </Panel>
              </div>
            ) : (
              <div role="tabpanel" id="editor-panel-export" aria-labelledby="editor-tab-export">
                <Highlight on={focus === 'export'} label="export">
                  <ExportPanel />
                </Highlight>
              </div>
            )}
          </aside>
        </div>

        <div className="flex h-7 items-center gap-4 border-t px-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            {tool === 'select' ? <CursorIcon className="size-2.5" /> : <HandIcon className="size-2.5" />}
            {tool === 'select' ? 'Selecionar' : 'Mover'}
          </span>
          <span className="hidden sm:inline">512 × 512 px</span>
          <span className="ml-auto hidden sm:inline">Snapping ligado</span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary" /> Pronto
          </span>
          <span>v{siteConfig.version}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The frame of the window, drawn per platform. Every element here is scenery: the dots and
 * the min/max/close glyphs belong to the picture of an app window, not to this page, so they
 * are hidden from assistive tech and carry no handler.
 */
function WindowChrome({ frame, os }: { frame: WindowFrame; os: 'windows' | 'macos' | 'linux' }) {
  if (frame === 'web') {
    return (
      <div className="flex h-9 items-center gap-3 border-b bg-muted px-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/20" />
          <span className="size-2.5 rounded-full bg-foreground/20" />
          <span className="size-2.5 rounded-full bg-foreground/20" />
        </span>
        <span className="mx-auto flex w-full max-w-sm items-center justify-center gap-1.5 truncate rounded-md bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
          <LockIcon className="size-2.5" /> mafhper.github.io/icon-core/app/
        </span>
        <span className="w-12" />
      </div>
    );
  }

  if (os === 'macos') {
    return (
      <div className="flex h-9 items-center border-b bg-muted px-3">
        <span aria-hidden className="flex gap-2">
          <span className="size-3 rounded-full bg-destructive" />
          <span className="size-3 rounded-full bg-chart-4" />
          <span className="size-3 rounded-full bg-primary" />
        </span>
        <span className="mx-auto text-[11px] font-medium text-muted-foreground">Icon-Core — circle-logo</span>
        <span className="w-14" />
      </div>
    );
  }

  if (os === 'linux') {
    return (
      <div className="flex h-10 items-center border-b bg-muted px-3">
        <span className="w-16" />
        <span className="mx-auto text-xs font-semibold">Icon-Core</span>
        <span aria-hidden className="flex w-16 justify-end">
          <span className="grid size-5 place-items-center rounded-full bg-foreground/10">
            <CloseIcon className="size-3" />
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center border-b bg-muted pl-3 text-[11px]">
      <span className="mr-2 grid size-3.5 place-items-center rounded-sm bg-foreground text-background">
        <span className="text-[8px] leading-none font-bold">I</span>
      </span>
      <span className="text-muted-foreground">Icon-Core</span>
      <span aria-hidden className="ml-auto flex h-full">
        <span className="grid w-11 place-items-center">
          <MinusIcon className="size-3" />
        </span>
        <span className="grid w-11 place-items-center">
          <SquareIcon className="size-2.5" />
        </span>
        <span className="grid w-11 place-items-center">
          <CloseIcon className="size-3.5" />
        </span>
      </span>
    </div>
  );
}

/** Circle, square, safe area and the center lines — the keylines the editor draws. */
function KeylineGuides() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      data-testid="editor-keylines"
      className="pointer-events-none absolute inset-0 h-full w-full text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.35}
    >
      <circle cx="50" cy="50" r="44" />
      <circle cx="50" cy="50" r="30" />
      <rect x="10" y="10" width="80" height="80" rx="8" />
      <rect x="17" y="12" width="66" height="76" rx="6" />
      <rect x="12" y="17" width="76" height="66" rx="6" />
      <line x1="0" y1="0" x2="100" y2="100" />
      <line x1="100" y1="0" x2="0" y2="100" />
      <line x1="50" y1="0" x2="50" y2="100" />
      <line x1="0" y1="50" x2="100" y2="50" />
    </svg>
  );
}

function ExportPanel() {
  const { appearance, radius } = useStudio();
  const [selected, setSelected] = useState<string[]>(['.ico', '.icns', '.png', '.svg']);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (progress === null || progress >= 100) return;
    const timer = setTimeout(() => setProgress((value) => Math.min(100, (value ?? 0) + 9)), 70);

    return () => clearTimeout(timer);
  }, [progress]);

  const toggle = (extension: string) =>
    setSelected((current) =>
      current.includes(extension) ? current.filter((item) => item !== extension) : [...current, extension]
    );

  return (
    <div className="space-y-4 p-4 text-xs">
      <div className="flex items-center gap-3">
        <IconGlyph appearance={appearance} radii={radius} size={40} />
        <div>
          <p className="font-medium">circle-logo</p>
          <p className="text-muted-foreground">Todas as aparências</p>
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="mb-2 text-[11px] font-medium text-muted-foreground">Formatos</legend>
        {exportFormats.map((format) => (
          <label
            key={format.ext}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(format.ext)}
              onChange={() => toggle(format.ext)}
              className="size-3.5 accent-primary"
            />
            <span className="w-11 font-mono font-semibold">{format.ext}</span>
            <span className="truncate text-muted-foreground">{format.detail}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={!selected.length || (progress !== null && progress < 100)}
        onClick={() => setProgress(0)}
        className="w-full cursor-pointer rounded-md bg-primary py-2 font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {progress === null
          ? `Exportar ${selected.length} formato${selected.length === 1 ? '' : 's'}`
          : progress < 100
            ? 'Exportando…'
            : 'Exportar de novo'}
      </button>
      {progress !== null && (
        <div className="space-y-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {progress < 100
              ? 'Gerando tamanhos…'
              : `icon-core-export.zip · ${selected.join(' ')} (demonstração)`}
          </p>
        </div>
      )}
    </div>
  );
}

function LayerGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="pb-2">
      <div className="flex items-center gap-1 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        <ChevronDownIcon className="size-3" /> {title} <span className="ml-auto font-mono font-normal">{count}</span>
      </div>
      <div className="space-y-0.5 px-1.5">{children}</div>
    </div>
  );
}

function LayerRow({
  name,
  thumb,
  visible,
  onToggle,
  locked,
  onLock,
  onDuplicate,
  onRemove
}: {
  name: string;
  thumb: ReactNode;
  visible: boolean;
  onToggle: () => void;
  locked: boolean;
  onLock: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      data-testid="editor-layer"
      className={cn(
        'group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-muted',
        !visible && 'opacity-55'
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted">{thumb}</span>
      <span className="flex-1 truncate">{name}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? `Ocultar ${name}` : `Mostrar ${name}`}
        aria-pressed={!visible}
        className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={onLock}
        aria-label={locked ? `Destravar ${name}` : `Travar ${name}`}
        aria-pressed={locked}
        className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
      >
        {locked ? <LockIcon className="size-3.5" /> : <UnlockIcon className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        title={`Duplicar ${name}`}
        aria-label={`Duplicar ${name}`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <CopyIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title={`Apagar ${name}`}
        aria-label={`Apagar ${name}`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <TrashIcon className="size-3.5" />
      </button>
    </div>
  );
}

/** One mock layer drawn on its own, the way the canvas would show it in isolation. */
function LayerThumb({ appearance, kind }: { appearance: Appearance; kind: LayerKind }) {
  return (
    <IconGlyph
      appearance={appearance}
      radii={20}
      size={22}
      layers={{ background: kind === 'background', petals: kind === 'petals', core: kind === 'core' }}
    />
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 px-4 py-3.5">
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  );
}

const DISPLAY_MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground';

/**
 * "Opções de exibição" used to be a span styled as a button — the toolbar promised a menu
 * and delivered a picture of one. It is a real menu now, driving the same keyline and grid
 * state as the panel switches below. Menu-button pattern: `aria-expanded` on the trigger,
 * focus moves into the list, arrows/Home/End walk it, Escape closes and returns focus, and
 * a press outside closes without stealing focus (same contract as the kit's SplitButton).
 */
function DisplayOptionsMenu({
  keyline,
  onKeyline,
  grid,
  onGrid
}: {
  keyline: boolean;
  onKeyline: (value: boolean) => void;
  grid: boolean;
  onGrid: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;

  const items = [
    { id: 'keylines', label: 'Keylines', checked: keyline, onSelect: () => onKeyline(!keyline) },
    { id: 'grid', label: 'Grade', checked: grid, onSelect: () => onGrid(!grid) }
  ];

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const select = (item: (typeof items)[number]) => {
    item.onSelect();
    close(true);
  };

  useEffect(() => {
    if (!open) return;

    itemRefs.current[0]?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);

    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === 'Tab') {
      close(false);
      return;
    }

    const list = itemRefs.current.filter((element): element is HTMLButtonElement => Boolean(element));
    const current = list.indexOf(document.activeElement as HTMLButtonElement);

    const focusAt = (index: number) => {
      event.preventDefault();
      list[(index + list.length) % list.length]?.focus();
    };

    if (event.key === 'ArrowDown') focusAt(current + 1);
    else if (event.key === 'ArrowUp') focusAt(current - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(list.length - 1);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      // Handled here so the native activation does not fire a second time.
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(true) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className="flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px]"
      >
        <SlidersIcon className="size-3" /> Opções de exibição <ChevronDownIcon className="size-3" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full left-0 z-50 mt-1 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-float"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.checked}
              tabIndex={-1}
              onClick={() => select(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(item);
                }
              }}
              className={DISPLAY_MENU_ITEM}
            >
              <span aria-hidden className="grid size-3.5 shrink-0 place-items-center">
                {item.checked && <CheckIcon className="size-3.5" />}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Only real toggles report a pressed state; undo, redo and zoom are plain buttons.
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid size-7 place-items-center rounded-md transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-muted hover:text-foreground',
        active && !disabled && 'bg-accent text-accent-foreground'
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
