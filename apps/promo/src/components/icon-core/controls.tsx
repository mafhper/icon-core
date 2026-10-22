import { useRef, type KeyboardEvent } from 'react';

import { APPEARANCES, CANVAS_PX, RADIUS_MAX, RADIUS_MIN, RADIUS_PRESETS, radiusFraction, radiusToPx, roundedRectPath } from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { SLIDER_THUMB_PX, Slider } from '../../ui/Slider';
import { IconGlyph } from './IconArt';
import { useStudio } from './studio-context';

type RadiusPreset = (typeof RADIUS_PRESETS)[number];

/** A preset counts as selected while the rail sits within half a step of it. */
const PRESET_TOLERANCE = 0.6;

/** Half of the rail's thumb (`size-4` in `Slider`): how far the thumb's centre stays inside. */
const THUMB_HALF_PX = SLIDER_THUMB_PX / 2;

/** Anchor glyphs, drawn inset so the stroke is not clipped by the viewBox. */
const ANCHOR_STROKE = 48;
const ANCHOR_BOX = CANVAS_PX - ANCHOR_STROKE;

/**
 * Frame radius: the rail plus its four presets, all writing to the shared studio state.
 *
 * The presets used to be four glyphs in a row under the rail, and that row was noise: three of the
 * presets are a rounded rect at 0 %, 4.7 % and 22.5 %, which at 14 px are the same picture. So only
 * the ends keep a glyph — a square and a circle, the two shapes the scale actually runs between —
 * and the four presets are tick marks drawn on the rail, each at the position the thumb takes when
 * that preset is selected. Every position comes from `RADIUS_PRESETS` through `radiusFraction`, so
 * the scale is written down once.
 *
 * The header is the one part of the card that has to change shape: "Raio da moldura" plus its
 * readout need ~121 px side by side at 11 px, and the block is 73 px wide in the narrowest card
 * (a 320 px window). Below 8rem the readout drops under the label instead of forcing the card to
 * reflow; below 10.5rem the label steps down to 11 px. That is compression of a 73 px block, not a
 * second layout of the card — the card itself never stacks.
 *
 * Every preset is a button rather than a painted decoration. `aria-label` names the radius in px —
 * the unit the slider announces — and `aria-pressed` follows the value, so all four presets stay
 * reachable and announced even though each of them is 2 px of ink.
 */
export function RadiusControl({ className, id = 'frame-radius' }: { className?: string; id?: string }) {
  const { radius, setRadius } = useStudio();

  return (
    <div className={cn('@container grid min-w-0 gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3 @max-[8rem]:grid @max-[8rem]:gap-0.5">
        <label htmlFor={id} className="text-[11px] font-medium text-foreground @min-[10.5rem]:text-xs">
          Raio da moldura
        </label>
        <output
          htmlFor={id}
          aria-hidden="true"
          className="font-mono text-[10px] tabular-nums text-muted-foreground @min-[8rem]:text-[11px]"
        >
          {radiusToPx(radius)} px
        </output>
      </div>

      <Slider
        id={id}
        aria-label="Raio da moldura"
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        step={0.25}
        value={radius}
        onValueChange={setRadius}
        formatValue={(next) => `${radiusToPx(next)} px`}
        hideValue
        trackSlots={{
          start: <RadiusAnchor preset={RADIUS_PRESETS[0]} />,
          end: <RadiusAnchor preset={RADIUS_PRESETS[RADIUS_PRESETS.length - 1]} />,
          overlay: (
            // Inset by half a thumb, so a mark at `left: fraction%` sits under the thumb itself.
            <div className="pointer-events-none absolute inset-y-0" style={{ left: THUMB_HALF_PX, right: THUMB_HALF_PX }}>
              {RADIUS_PRESETS.map((preset) => (
                <RadiusTick key={preset.id} preset={preset} radius={radius} onSelect={setRadius} />
              ))}
            </div>
          )
        }}
      />
    </div>
  );
}

type PresetProps = { preset: RadiusPreset; radius: number; onSelect: (value: number) => void };

const isSelected = (radius: number, preset: RadiusPreset) => Math.abs(radius - preset.value) < PRESET_TOLERANCE;

/** The name every preset is announced by: the radius it sets, in the slider's own unit. */
const presetName = (preset: RadiusPreset) => `Raio ${radiusToPx(preset.value)} px`;

/**
 * One end of the scale, drawn as the shape it stands for: the square at 0, the circle at 50. It is
 * scenery, not a control — the tick at that same position is the control, and two accessible names
 * for one preset would be one too many.
 *
 * Under 6.5rem of block the anchors step out: two 16 px glyphs and their gaps eat 44 px of the rail,
 * and on a 73 px rail that leaves the thumb 29 px of travel — less than the four marks need. The
 * ticks at 0 % and 100 % already mark the ends the anchors name.
 */
function RadiusAnchor({ preset }: { preset: RadiusPreset }) {
  return (
    <span
      aria-hidden="true"
      className="hidden size-4 shrink-0 place-items-center text-muted-foreground @min-[6.5rem]:grid"
    >
      <svg viewBox="0 0 512 512" className="size-3.5">
        <path
          d={roundedRectPath(ANCHOR_BOX, preset.value)}
          transform={`translate(${ANCHOR_STROKE / 2} ${ANCHOR_STROKE / 2})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={ANCHOR_STROKE}
        />
      </svg>
    </span>
  );
}

/**
 * A preset that is only a mark on the rail. The hit box — 16 px wide, 24 px tall — is what makes
 * 2 px of ink clickable: wide enough to be a target, narrow enough that the rail stays draggable
 * between two marks. It is centred on the tick, so the ink and the target share a position.
 */
function RadiusTick({ preset, radius, onSelect }: PresetProps) {
  const selected = isSelected(radius, preset);

  return (
    <button
      type="button"
      title={preset.label}
      aria-label={presetName(preset)}
      aria-pressed={selected}
      onClick={() => onSelect(preset.value)}
      style={{ left: `${radiusFraction(preset.value) * 100}%` }}
      className="group pointer-events-auto absolute top-1/2 h-6 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 left-1/2 block h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
          selected ? 'bg-primary' : 'bg-border group-hover:bg-muted-foreground'
        )}
      />
    </button>
  );
}

/**
 * The four appearances as a radio group, laid out exactly as the landing mockup lays them out
 * (`mockup-lovable-shader/main/src/components/icon-core/controls.tsx`, `AppearanceDock`): one row
 * of four equal tiles, `flex gap-1` + `min-w-0 flex-1`, glyph above the label. The row never wraps
 * and never becomes a grid; what adapts is the tile's density, measured from the dock's own box:
 * `px-2` / 11 px with the mockup's 293 px, and `px-1` / 10 px once the card squeezes the dock under
 * 240 px. The gap stays the mockup's 4 px at both ends — it is the one measurement that still reads
 * the same when the tiles are 43 px. The labels themselves are never capped: as in the mockup they
 * may use the tile's full width, so a squeezed tile lets its label reach into the gap beside it
 * instead of truncating.
 *
 * Roving tabindex keeps one stop for the whole dock and the arrow keys walk it, which is the
 * expected keyboard model for radios.
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
    <div className={cn('@container min-w-0', className)}>
      <div role="radiogroup" aria-label="Aparência do ícone e do site" className="flex gap-1">
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
                'group relative flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-transparent px-1 pt-2 pb-1.5 text-[10px] text-muted-foreground transition-all hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none @min-[15rem]:px-2 @min-[15rem]:text-[11px]',
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
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
