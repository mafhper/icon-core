import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../utils/cn';
import { Field } from './Field';
import { Popover } from './Popover';
import { COLOR_LIBRARY, DEFAULT_PALETTE_ID, findPalette } from '../library/colorLibrary';
import {
  hexToRgb,
  normalizeHex,
  parseColor,
  rgbToCss,
  rgbToHsl,
  type Rgb
} from '../utils/color';

export interface ColorValue {
  /** `#rrggbb`. */
  color: string;
  /** 0..1. */
  alpha: number;
}

export type ColorFormat = 'hex' | 'rgba' | 'hsla';

export interface ColorFieldProps {
  label: string;
  hint?: ReactNode;
  value: ColorValue;
  onChange: (value: ColorValue) => void;
  disabled?: boolean;
  className?: string;
  /**
   * `field` (default) stacks the label above; `inline` renders just the
   * `[swatch][#hex][alpha%]` row so it can live inside `ControlRow`/`InlineField`.
   */
  variant?: 'field' | 'inline';
  /** Called when the picker closes, so transient edits can be committed once. */
  onCommit?: () => void;
}

const RECENT_KEY = 'iconcore:recent-colors';

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const pushRecent = (hex: string): string[] => {
  try {
    const next = [hex, ...readRecent().filter((c) => c !== hex)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readRecent();
  }
};

const checkerStyle = {
  backgroundImage:
    'linear-gradient(45deg, rgba(128,128,128,.5) 25%, transparent 25%),' +
    'linear-gradient(-45deg, rgba(128,128,128,.5) 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, rgba(128,128,128,.5) 75%),' +
    'linear-gradient(-45deg, transparent 75%, rgba(128,128,128,.5) 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
} as const;

const formatValue = (value: ColorValue, format: ColorFormat): string => {
  const rgb = hexToRgb(value.color);
  if (format === 'hex') return normalizeHex(value.color).toUpperCase();
  if (format === 'rgba') return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(value.alpha.toFixed(2))})`;
  const { h, s, l } = rgbToHsl(rgb);
  return `hsla(${h}, ${s}%, ${l}%, ${Number(value.alpha.toFixed(2))})`;
};

/**
 * Alpha is the 4th component of `rgba()/hsla()`. Parsed by splitting on commas
 * (no regex — keeps CodeQL free of polynomial-regexp alerts on typed input).
 */
const parseAlpha = (text: string, fallback: number): number => {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open === -1 || close === -1 || close < open) return fallback;
  const parts = text.slice(open + 1, close).split(',');
  if (parts.length < 4) return fallback;
  const value = Number(parts[3].trim());
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
};

/**
 * Labelled colour swatch that opens an RGBA/HSLA picker (SV area + hue via
 * `react-colorful`, alpha slider, HEX/RGBA/HSLA fields and recent colours).
 */
export const ColorField = ({ label, hint, value, onChange, disabled, className, variant = 'field', onCommit }: ColorFieldProps) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [draft, setDraft] = useState(() => formatValue(value, 'hex'));
  const [hexDraft, setHexDraft] = useState(() => normalizeHex(value.color).slice(1).toUpperCase());
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [paletteId, setPaletteId] = useState<string>(DEFAULT_PALETTE_ID);
  const palette = findPalette(paletteId) ?? findPalette(DEFAULT_PALETTE_ID);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const PANEL_WIDTH = 300;

  useEffect(() => {
    setDraft(formatValue(value, format));
  }, [value, format]);

  useEffect(() => {
    setHexDraft(normalizeHex(value.color).slice(1).toUpperCase());
  }, [value.color]);

  const close = () => {
    setRecent(pushRecent(normalizeHex(value.color)));
    setOpen(false);
    onCommit?.();
  };

  const commitDraft = () => {
    const parsed = parseColor(draft);
    if (!parsed) {
      setDraft(formatValue(value, format));
      return;
    }
    onChange({ color: parsed.hex, alpha: parseAlpha(draft, value.alpha) });
  };

  const setAlpha = (alpha: number) => onChange({ ...value, alpha: Math.max(0, Math.min(1, alpha)) });

  const commitHex = () => {
    const body = hexDraft.trim().replace(/^#/, '');
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(body)) {
      onChange({ ...value, color: normalizeHex(body) });
      setHexDraft(normalizeHex(body).slice(1).toUpperCase());
      return;
    }
    setHexDraft(normalizeHex(value.color).slice(1).toUpperCase());
  };
  const rgb: Rgb = hexToRgb(value.color);
  const alphaPct = Math.round(value.alpha * 100);

  const content = (
      <div className={cn('relative', className)}>
        {/* Paint field (OpenPencil): `[swatch][#hex][| 100 %]` is ONE flat
            surface. No nested boxes, no stretched sub-fields — the single row
            keeps its height and the hex input absorbs the slack. */}
        <div className="flex h-[var(--ic-control-md)] min-w-0 flex-1 items-center overflow-hidden rounded-[var(--ic-field-radius)] bg-ic-elevated hover:bg-ic-overlay focus-within:ring-1 focus-within:ring-ic-accent-ring">
          <button
            type="button"
            ref={triggerRef}
            disabled={disabled}
            onClick={() => (open ? close() : setOpen(true))}
            className="ml-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-ic-border disabled:cursor-not-allowed disabled:opacity-40"
            style={checkerStyle}
            aria-label={`Choose ${label}`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="block h-full w-full rounded-[3px]" style={{ background: rgbToCss(rgb, value.alpha) }} />
          </button>

          <span className="select-none pl-1 font-mono text-ic-text-muted">#</span>
          <input
            value={hexDraft}
            disabled={disabled}
            aria-label={`${label} hex`}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitHex();
            }}
            className="min-w-0 flex-1 rounded-none bg-transparent p-0 font-mono text-[length:var(--ic-control-font-size)] uppercase text-ic-text outline-none disabled:opacity-40"
          />

          <span className="h-4 w-px shrink-0 bg-ic-border" />

          <input
            type="number"
            min="0"
            max="100"
            value={alphaPct}
            disabled={disabled}
            aria-label={`${label} alpha percent`}
            onChange={(event) => setAlpha(Number(event.target.value) / 100)}
            className="w-8 shrink-0 rounded-none bg-transparent p-0 text-right tabular-nums text-[length:var(--ic-control-font-size)] text-ic-text outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
          />
          <span className="select-none pr-1 text-ic-text-muted">%</span>
        </div>

        <Popover
          open={open}
          anchorRef={triggerRef}
          onClose={close}
          width={PANEL_WIDTH}
          aria-label={`${label} picker`}
        >
            <div className="ic-picker">
              <HexColorPicker
                color={normalizeHex(value.color)}
                onChange={(hex) => onChange({ ...value, color: hex })}
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="h-4 w-8 shrink-0 rounded-ic-sm border border-ic-border" style={checkerStyle}>
                <span className="block h-full w-full rounded-ic-sm" style={{ background: rgbToCss(rgb, 1) }} />
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={alphaPct}
                aria-label="Alpha"
                onChange={(event) => setAlpha(Number(event.target.value) / 100)}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ic-border [&::-moz-range-thumb]:bg-ic-text [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ic-border [&::-webkit-slider-thumb]:bg-ic-text"
                style={{
                  backgroundImage:
                    `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgb(${rgb.r}, ${rgb.g}, ${rgb.b})), ` +
                    'linear-gradient(45deg, #999 25%, transparent 25%), linear-gradient(-45deg, #999 25%, transparent 25%)',
                  backgroundSize: '100% 100%, 6px 6px, 6px 6px'
                }}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={alphaPct}
                aria-label="Alpha percent"
                onChange={(event) => setAlpha(Number(event.target.value) / 100)}
                className="w-11 rounded-[var(--ic-field-radius)] bg-ic-elevated px-1 py-0.5 text-center font-mono text-[0.6875rem] text-ic-text outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={format}
                aria-label="Colour format"
                onChange={(event) => setFormat(event.target.value as ColorFormat)}
                className="h-6 w-[78px] shrink-0 rounded-[var(--ic-field-radius)] bg-ic-elevated pl-2 text-[0.6875rem] text-ic-text outline-none"
              >
                <option value="hex">HEX</option>
                <option value="rgba">RGBA</option>
                <option value="hsla">HSLA</option>
              </select>
              <input
                value={draft}
                aria-label="Colour value"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitDraft();
                }}
                className="h-6 min-w-0 flex-1 rounded-[var(--ic-field-radius)] bg-ic-elevated px-2 font-mono text-[0.6875rem] text-ic-text outline-none"
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">Library</span>
                <select
                  value={paletteId}
                  aria-label="Colour palette"
                  onChange={(event) => setPaletteId(event.target.value)}
                  className="h-6 w-40 rounded-[var(--ic-field-radius)] bg-ic-elevated pl-2 text-[0.6875rem] text-ic-text outline-none"
                >
                  {COLOR_LIBRARY.map((system) => (
                    <optgroup key={system.id} label={system.name}>
                      {system.palettes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {(palette?.colors ?? []).map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    aria-label={`Use ${hex}`}
                    onClick={() => onChange({ ...value, color: hex })}
                    className="h-5 w-5 rounded-[3px] border border-ic-border"
                    style={{ background: hex }}
                  />
                ))}
              </div>
              {palette != null && (
                <p className="mt-1 text-[0.6875rem] leading-snug text-ic-text-muted">{palette.purpose}</p>
              )}
            </div>

            {recent.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">Recent</p>
                <div className="flex flex-wrap gap-1">
                  {recent.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      aria-label={`Use ${hex}`}
                      onClick={() => onChange({ ...value, color: hex })}
                      className="h-5 w-5 rounded-ic-sm border border-ic-border"
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </div>
            )}
        </Popover>
      </div>
  );

  if (variant === 'inline') {
    return (
      <div role="group" aria-label={label}>
        {content}
      </div>
    );
  }

  return (
    <Field label={label} hint={hint}>
      {content}
    </Field>
  );
};
