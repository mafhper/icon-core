import { useRef, type KeyboardEvent } from 'react';

import { APPEARANCES, RADIUS_PRESETS, radiusToPx, roundedRectPath } from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { Slider } from '../../ui/Slider';
import { IconGlyph } from './IconArt';
import { useStudio } from './studio-context';

/** Frame radius: slider plus the four presets, all writing to the shared studio state. */
export function RadiusControl({ className, id = 'frame-radius' }: { className?: string; id?: string }) {
  const { radius, setRadius } = useStudio();

  return (
    <div className={cn('grid gap-3', className)}>
      <Slider
        id={id}
        label="Raio da moldura"
        min={0}
        max={50}
        step={0.25}
        value={radius}
        onValueChange={setRadius}
        formatValue={(next) => `${radiusToPx(next)} px`}
      />
      <div className="flex items-center justify-between">
        {RADIUS_PRESETS.map((preset) => {
          const active = Math.abs(radius - preset.value) < 0.6;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={active}
              onClick={() => setRadius(preset.value)}
              className={cn(
                'grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active && 'text-primary'
              )}
            >
              <svg viewBox="0 0 512 512" className="size-3.5">
                <path d={roundedRectPath(512, preset.value)} fill="none" stroke="currentColor" strokeWidth={48} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The four appearances as a radio group. Roving tabindex keeps one stop for the whole dock
 * and the arrow keys walk it, which is the expected keyboard model for radios.
 *
 * The layout reads the **container**, never the viewport. The label, not the glyph, is the
 * long pole: "Monochrome" is ~67px at 11px and the tile adds `px-2` (16px) plus its border
 * (2px), so an intact tile needs ~85px. Two of them plus the 4px gap fit from 180px, and
 * below that the dock stacks — a tile narrower than its own word can only clip, so `max-w-full`
 * on the label keeps `truncate` honest instead of painting the text over the neighbours.
 *
 * Both hosts cap the slot below the ~354px four tiles would need (293px in the hero card,
 * 320px by `max-w-xs` in the editor), which is why the ladder stops at two columns. A `sm:`
 * breakpoint here was the defect: at a 1258px window the hero column is 149px and the row
 * still turned on, squeezing four ~34px tiles into "DefaultLightDarkonochrome".
 */
export function AppearanceDock({ className, size = 44 }: { className?: string; size?: number }) {
  const { appearance, setAppearance, radius } = useStudio();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;

    event.preventDefault();
    const next = (index + step + APPEARANCES.length) % APPEARANCES.length;
    setAppearance(APPEARANCES[next]?.id ?? 'default');
    refs.current[next]?.focus();
  };

  return (
    <div className={cn('@container', className)}>
      <div
        role="radiogroup"
        aria-label="Aparência do ícone e do site"
        className="grid grid-cols-1 gap-1 @min-[11.25rem]:grid-cols-2"
      >
        {APPEARANCES.map((item, index) => {
          const active = item.id === appearance;
          return (
            <button
              key={item.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => onKey(event, index)}
              onClick={() => setAppearance(item.id)}
              className={cn(
                'group relative flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-transparent px-2 pt-2 pb-1.5 text-[11px] text-muted-foreground transition-all hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active && 'border-border bg-card text-foreground shadow-float'
              )}
            >
              {active && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />}
              <IconGlyph
                appearance={item.id}
                radii={radius}
                size={size}
                className="transition-transform duration-300 group-hover:-translate-y-0.5"
              />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
