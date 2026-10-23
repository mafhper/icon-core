import { useState, type ReactNode } from 'react';

import type { Radii } from '../../lib/appearance';
import { exportFormats } from '../../lib/site-config';
import { IconGlyph } from './IconArt';
import { useStudio } from './studio-context';

const ANDROID_SHAPES: { label: string; radii: Radii }[] = [
  { label: 'círculo', radii: 50 },
  { label: 'squircle', radii: 30 },
  { label: 'gota', radii: [50, 50, 12, 50] },
  { label: 'arredondado', radii: 16 },
];

/**
 * The same icon in the six places it lands. Android's mask is the only variable one — the
 * system lets the launcher crop it, so the tile cycles the shapes on click.
 */
export function Platforms() {
  const { appearance } = useStudio();
  const [android, setAndroid] = useState(0);
  const shape = ANDROID_SHAPES[android] ?? ANDROID_SHAPES[0];

  return (
    <section id="plataformas" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Exporte uma vez</p>
            <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
              O mesmo ícone em todo lugar.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cada sistema recorta o ícone do seu jeito. Mude a aparência lá em cima e veja tudo acompanhar.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Tile name="macOS" mask="squircle">
            <div className="flex items-end gap-1.5 rounded-2xl border border-glass-border bg-glass px-2 py-2 shadow-float backdrop-blur">
              <span className="size-7 rounded-[22.5%] bg-muted-foreground/25" />
              <span className="relative flex flex-col items-center">
                <IconGlyph appearance={appearance} radii={22.5} size={44} label="Ícone no Dock do macOS" />
                <span className="absolute -bottom-1.5 size-1 rounded-full bg-foreground/60" />
              </span>
              <span className="size-7 rounded-[22.5%] bg-muted-foreground/25" />
            </div>
          </Tile>

          <Tile name="iOS" mask="squircle">
            <div className="flex flex-col items-center gap-1.5">
              <IconGlyph appearance={appearance} radii={22.5} size={56} label="Ícone na tela inicial do iOS" />
              <span className="text-[11px] font-medium">Icon-Core</span>
            </div>
          </Tile>

          <Tile
            name="Android"
            mask={shape.label}
            onClick={() => setAndroid((index) => (index + 1) % ANDROID_SHAPES.length)}
            hint="Toque para trocar a máscara"
          >
            <div className="relative grid size-20 place-items-center">
              <div className="absolute inset-0 rounded-md border border-dashed border-foreground/25 opacity-80" />
              <IconGlyph appearance={appearance} radii={shape.radii} size={60} label="Ícone adaptativo do Android" />
            </div>
          </Tile>

          <Tile name="Windows" mask="quadrado">
            <div className="flex items-center gap-1 rounded-lg border bg-background/80 px-2 py-1.5 shadow-float">
              <span className="size-5 rounded-sm bg-muted-foreground/20" />
              <span className="relative grid size-9 place-items-center rounded-md bg-accent">
                <IconGlyph appearance={appearance} radii={6} size={24} label="Ícone na barra de tarefas do Windows" />
                <span className="absolute bottom-0.5 h-[3px] w-3.5 rounded-full bg-primary" />
              </span>
              <span className="size-5 rounded-sm bg-muted-foreground/20" />
            </div>
          </Tile>

          <Tile name="Linux" mask="livre">
            <div className="flex items-center gap-2 rounded-2xl bg-foreground/85 p-2">
              <span className="size-6 rounded-lg bg-background/20" />
              <span className="relative">
                <IconGlyph appearance={appearance} radii={20} size={40} label="Ícone no Dash do GNOME" />
                <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-background" />
              </span>
              <span className="size-6 rounded-lg bg-background/20" />
            </div>
          </Tile>

          <Tile name="Web" mask="favicon">
            <div className="flex w-full max-w-[9.5rem] items-center gap-2 rounded-t-lg border border-b-0 bg-background px-2.5 py-2 text-[11px] shadow-float">
              <IconGlyph appearance={appearance} radii={18} size={16} label="Favicon na aba do navegador" />
              <span className="truncate">Icon-Core</span>
              <span className="ml-auto text-muted-foreground">×</span>
            </div>
          </Tile>
        </div>

        <dl className="mt-3 grid grid-cols-2 divide-border overflow-hidden rounded-2xl border bg-card sm:grid-cols-5 sm:divide-x">
          {exportFormats.map((format) => (
            <div key={format.ext} className="flex items-baseline justify-between gap-2 px-4 py-3 sm:flex-col sm:gap-0.5">
              <dt className="font-mono text-sm font-semibold">{format.ext}</dt>
              <dd className="text-xs text-muted-foreground">{format.target}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Tile({
  name,
  mask,
  onClick,
  hint,
  children,
}: {
  name: string;
  mask: string;
  onClick?: () => void;
  hint?: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <div className="grid h-36 place-items-center bg-[radial-gradient(90%_80%_at_50%_0%,var(--mint),transparent_70%)] px-3">
        {children}
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t px-3.5 py-2.5">
        <span className="text-sm font-medium">{name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{mask}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={hint}
        aria-label={`${name}: ${hint}`}
        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card text-left transition-colors hover:border-primary/40"
      >
        {body}
      </button>
    );
  }

  return <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-colors">{body}</div>;
}
