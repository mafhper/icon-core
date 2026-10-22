import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { pagePresetFor, TILE_PRESETS } from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { SPECULAR_STYLE } from '../../lib/decor';
import { siteConfig } from '../../lib/site-config';
import { AppearanceDock, RadiusControl } from './controls';
import { DownloadButton, WebAppButton } from './DownloadButton';
import { CollapseIcon, LayersIcon } from './icons';
import { CoreSvg, PetalsSvg } from './IconArt';
import { ShaderCanvas } from './ShaderCanvas';
import { useStudio } from './studio-context';

const LAYER_LABELS = ['Camada de fundo', 'Elemento · pétalas', 'Elemento · núcleo', 'Vidro · especular'] as const;

/** `--icon` is a custom property, which `CSSProperties` does not index. */
const STAGE_STYLE = {
  width: 'calc(var(--icon) * 1.45)',
  height: 'calc(var(--icon) * 1.45)',
  perspective: 1600,
  '--icon': 'clamp(11rem, 44vmin, 25rem)',
} as CSSProperties;

export function Hero() {
  const { appearance, dark } = useStudio();

  return (
    <section id="top" className="relative isolate flex min-h-svh flex-col overflow-hidden pt-20">
      <ShaderCanvas
        preset={pagePresetFor(appearance, dark)}
        renderScale={0.45}
        className="absolute inset-0 -z-10 h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-8 px-4 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_auto] lg:gap-x-10 lg:gap-y-8">
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />v{siteConfig.version} · nova interface
          </p>
          <h1 className="font-display text-5xl leading-[0.95] font-semibold tracking-[-0.045em] sm:text-6xl xl:text-7xl">
            Um ícone.
            <br />
            <span className="text-muted-foreground">Todas as telas.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
            Monte camadas, escolha a aparência e exporte para Windows, macOS, Linux, celular e web de uma vez.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <DownloadButton size="lg" mobileFallback={false} />
            <WebAppButton size="lg" className="bg-background/60 backdrop-blur" />
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:items-center">
          <IconStage />
        </div>

        <div className="order-3 w-full max-w-xl lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start">
          <div className="grid gap-5 rounded-2xl border border-glass-border bg-glass p-4 shadow-float backdrop-blur-xl sm:grid-cols-[minmax(0,13rem)_1px_minmax(0,1fr)] sm:items-center">
            <RadiusControl />
            <div className="hidden h-full w-px bg-border sm:block" />
            <AppearanceDock size={38} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The icon as the editor composes it: four absolutely positioned layers that separate on
 * demand. The stage writes `--px` / `--py` (normalized pointer offset) and the layers read
 * it for parallax; under reduced motion the values stay at zero.
 */
function IconStage() {
  const { appearance, radius, reducedMotion, pointer } = useStudio();
  const stageRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    let raf = 0;
    const current = { x: 0, y: 0 };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rect = element.getBoundingClientRect();
      const point = pointer.current;
      let tx = 0;
      let ty = 0;
      if (!reducedMotion && point.active) {
        tx = Math.max(-1, Math.min(1, (point.x - (rect.left + rect.width / 2)) / (window.innerWidth / 2)));
        ty = Math.max(-1, Math.min(1, (point.y - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
      }
      current.x += (tx - current.x) * 0.08;
      current.y += (ty - current.y) * 0.08;
      element.style.setProperty('--px', current.x.toFixed(4));
      element.style.setProperty('--py', current.y.toFixed(4));
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [pointer, reducedMotion]);

  const radiusStyle: CSSProperties = { borderRadius: `${radius}%` };

  return (
    <div className="flex flex-col items-center gap-5">
      <div ref={stageRef} className="relative grid place-items-center" style={STAGE_STYLE}>
        <EditorGuides />
        <div
          className="relative transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{
            width: 'var(--icon)',
            height: 'var(--icon)',
            transformStyle: 'preserve-3d',
            transform: exploded ? 'rotateX(56deg) rotateZ(-36deg) scale(.82)' : 'none',
          }}
        >
          <Layer z={0} exploded={exploded} label={LAYER_LABELS[0]} style={radiusStyle} className="shadow-icon">
            <ShaderCanvas preset={TILE_PRESETS[appearance]} renderScale={0.9} className="h-full w-full" />
          </Layer>
          <Layer z={1} exploded={exploded} label={LAYER_LABELS[1]} style={radiusStyle} depth={7} outline>
            <PetalsSvg appearance={appearance} className="h-full w-full drop-shadow-[0_6px_10px_rgb(0_0_0/0.12)]" />
          </Layer>
          <Layer z={2} exploded={exploded} label={LAYER_LABELS[2]} style={radiusStyle} depth={15} outline>
            <CoreSvg appearance={appearance} className="h-full w-full drop-shadow-[0_10px_14px_rgb(0_0_0/0.22)]" />
          </Layer>
          <Layer z={3} exploded={exploded} label={LAYER_LABELS[3]} style={radiusStyle} outline>
            <div className="h-full w-full" style={{ ...radiusStyle, ...SPECULAR_STYLE }} />
          </Layer>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExploded((value) => !value)}
        aria-pressed={exploded}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-glass-border bg-glass px-3.5 py-1.5 text-xs font-medium text-foreground shadow-float backdrop-blur transition-colors hover:bg-card"
      >
        {exploded ? <CollapseIcon className="size-3.5" /> : <LayersIcon className="size-3.5" />}
        {exploded ? 'Juntar camadas' : 'Separar camadas'}
      </button>
    </div>
  );
}

function Layer({
  z,
  exploded,
  label,
  style,
  depth = 0,
  className,
  outline,
  children,
}: {
  z: number;
  exploded: boolean;
  label: string;
  style: CSSProperties;
  depth?: number;
  className?: string;
  outline?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
      style={{ transform: `translateZ(${exploded ? z * 80 : z * 0.5}px)`, transformStyle: 'preserve-3d' }}
    >
      <div
        className={cn(
          'h-full w-full overflow-hidden transition-[border-radius,box-shadow,outline-color] duration-300 motion-reduce:transition-none',
          outline && 'outline outline-1 -outline-offset-1 outline-transparent',
          outline && exploded && 'outline-foreground/25',
          className
        )}
        style={style}
      >
        <div
          className="h-full w-full"
          style={{ transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)` }}
        >
          {children}
        </div>
      </div>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-[104%] -translate-y-1/2 rounded-md border bg-card px-2 py-1 font-mono text-xs whitespace-nowrap text-foreground shadow-float transition-opacity duration-500',
          exploded ? 'opacity-100 delay-300' : 'opacity-0'
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Editor guides around the icon: circles, keyline square and safe-area diagonals. */
function EditorGuides() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-foreground/15"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.18}
      style={{ transform: 'translate3d(calc(var(--px, 0) * -4px), calc(var(--py, 0) * -4px), 0)' }}
    >
      <circle cx="50" cy="50" r="34.48" />
      <circle cx="50" cy="50" r="24" strokeDasharray="0.8 0.8" />
      <rect x="15.5" y="15.5" width="69" height="69" rx="15" />
      <rect x="22" y="22" width="56" height="56" rx="0" strokeDasharray="0.8 0.8" />
      <line x1="50" y1="2" x2="50" y2="98" />
      <line x1="2" y1="50" x2="98" y2="50" />
      <line x1="10" y1="10" x2="90" y2="90" strokeDasharray="0.4 1.2" />
      <line x1="90" y1="10" x2="10" y2="90" strokeDasharray="0.4 1.2" />
      <g className="text-primary/60" stroke="currentColor" strokeWidth={0.3}>
        <path d="M15.5 12 v-2 M84.5 12 v-2 M15.5 11 H84.5" />
      </g>
    </svg>
  );
}
