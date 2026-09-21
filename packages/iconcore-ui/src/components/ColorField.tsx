import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../utils/cn';
import { Field } from './Field';
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

const parseAlpha = (text: string, fallback: number): number => {
  const match = /rgba?\([^)]*,\s*([\d.]+)\s*\)/i.exec(text) ?? /hsla?\([^)]*,\s*([\d.]+)\s*\)/i.exec(text);
  if (!match) return fallback;
  const a = Number(match[1]);
  return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : fallback;
};

/**
 * Labelled colour swatch that opens an RGBA/HSLA picker (SV area + hue via
 * `react-colorful`, alpha slider, HEX/RGBA/HSLA fields and recent colours).
 */
export const ColorField = ({ label, hint, value, onChange, disabled, className }: ColorFieldProps) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [draft, setDraft] = useState(() => formatValue(value, 'hex'));
  const [hexDraft, setHexDraft] = useState(() => normalizeHex(value.color).slice(1).toUpperCase());
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(formatValue(value, format));
  }, [value, format]);

  useEffect(() => {
    setHexDraft(normalizeHex(value.color).slice(1).toUpperCase());
  }, [value.color]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setRecent(pushRecent(normalizeHex(value.color)));
    setOpen(false);
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

  return (
    <Field label={label} hint={hint}>
      <div ref={rootRef} className={cn('relative', className)}>
        {/* Compact row (Rune Icons pattern): swatch · #hex · alpha%. Fixed-width
            fields keep the control from overflowing in narrow columns. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => (open ? close() : setOpen(true))}
            className="h-7 w-7 shrink-0 rounded-ic-sm border border-ic-border disabled:cursor-not-allowed disabled:opacity-40"
            style={checkerStyle}
            aria-label={`${label} colour picker`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="block h-full w-full rounded-ic-sm" style={{ background: rgbToCss(rgb, value.alpha) }} />
          </button>

          <div className="flex h-7 min-w-0 flex-1 items-center rounded-ic-sm border border-ic-border bg-ic-surface px-1.5 font-mono text-[11px]">
            <span className="select-none text-ic-text-muted">#</span>
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
              className="min-w-0 flex-1 bg-transparent text-right uppercase text-ic-text focus:outline-none disabled:opacity-40"
            />
          </div>

          <div className="flex h-7 w-14 shrink-0 items-center justify-end rounded-ic-sm border border-ic-border bg-ic-surface px-1.5 font-mono text-[11px]">
            <input
              type="number"
              min="0"
              max="100"
              value={alphaPct}
              disabled={disabled}
              aria-label={`${label} alpha percent`}
              onChange={(event) => setAlpha(Number(event.target.value) / 100)}
              className="w-7 bg-transparent text-right text-ic-text focus:outline-none disabled:opacity-40"
            />
            <span className="select-none text-ic-text-muted">%</span>
          </div>
        </div>

        {open && (
          <div
            role="dialog"
            aria-label={`${label} picker`}
            className="absolute z-50 mt-2 w-[248px] rounded-ic-md border border-ic-border bg-ic-overlay p-3 shadow-xl"
          >
            <HexColorPicker
              color={normalizeHex(value.color)}
              onChange={(hex) => onChange({ ...value, color: hex })}
            />

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
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
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
                className="w-12 rounded-ic-sm border border-ic-border bg-ic-surface px-1 py-0.5 text-center font-mono text-[11px] text-ic-text"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={format}
                aria-label="Colour format"
                onChange={(event) => setFormat(event.target.value as ColorFormat)}
                className="h-7 rounded-ic-sm border border-ic-border bg-ic-surface px-1 text-[11px] text-ic-text"
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
                className="h-7 min-w-0 flex-1 rounded-ic-sm border border-ic-border bg-ic-surface px-2 font-mono text-[11px] text-ic-text"
              />
            </div>

            {recent.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-ic-text-muted">Recent</p>
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
          </div>
        )}
      </div>
    </Field>
  );
};
