import { useEffect, useMemo, useState } from 'react';

type ColorFormat = 'hex' | 'rgb' | 'hsl';

interface ColorInputFieldProps {
  label: string;
  valueHex: string;
  onChangeHex: (value: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value: string): string | null => {
  const clean = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const full = clean.length === 3 ? clean.split('').map((char) => `${char}${char}`).join('') : clean;
  return `#${full.toLowerCase()}`;
};

const hexToRgb = (hex: string) => {
  const parsed = normalizeHex(hex) ?? '#000000';
  const raw = parsed.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;

const hexToHsl = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === nr) h = ((ng - nb) / delta) % 6;
    else if (max === ng) h = (nb - nr) / delta + 2;
    else h = (nr - ng) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

const hslToHex = (h: number, s: number, l: number) => {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let rp: number;
  let gp: number;
  let bp: number;

  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
};

const toFormatted = (hex: string, format: ColorFormat) => {
  if (format === 'hex') return normalizeHex(hex) ?? '#000000';
  if (format === 'rgb') {
    const { r, g, b } = hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
  }
  const { h, s, l } = hexToHsl(hex);
  return `${h}, ${s}%, ${l}%`;
};

const parseFormatted = (value: string, format: ColorFormat): string | null => {
  if (format === 'hex') return normalizeHex(value);

  const parts = value
    .replace(/[()]/g, '')
    .split(',')
    .map((part) => part.trim());

  if (parts.length !== 3) return null;

  if (format === 'rgb') {
    const [r, g, b] = parts.map((part) => Number.parseFloat(part));
    if ([r, g, b].some((item) => Number.isNaN(item))) return null;
    return rgbToHex(r, g, b);
  }

  const h = Number.parseFloat(parts[0].replace(/deg/gi, ''));
  const s = Number.parseFloat(parts[1].replace('%', ''));
  const l = Number.parseFloat(parts[2].replace('%', ''));
  if ([h, s, l].some((item) => Number.isNaN(item))) return null;
  return hslToHex(h, s, l);
};

export const ColorInputField = ({ label, valueHex, onChangeHex }: ColorInputFieldProps) => {
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [valueText, setValueText] = useState(toFormatted(valueHex, 'hex'));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setValueText(toFormatted(valueHex, format));
    setHasError(false);
  }, [valueHex, format]);

  const help = useMemo(() => {
    if (format === 'hex') return '#rrggbb';
    if (format === 'rgb') return 'r, g, b';
    return 'h, s%, l%';
  }, [format]);

  const commitText = () => {
    const parsed = parseFormatted(valueText, format);
    if (!parsed) {
      setHasError(true);
      return;
    }
    setHasError(false);
    onChangeHex(parsed);
  };

  return (
    <label className="color-input-field grid gap-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.08em] text-core-muted">{label}</span>
        <select value={format} onChange={(event) => setFormat(event.target.value as ColorFormat)} className="color-format-select">
          <option value="hex">HEX</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
      </div>
      <div className="color-input-row">
        <input type="color" value={normalizeHex(valueHex) ?? '#000000'} onChange={(event) => onChangeHex(event.target.value)} className="h-10 w-12 rounded-lg border border-core-border bg-core-elevated p-1" />
        <input
          value={valueText}
          onChange={(event) => setValueText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitText();
            }
          }}
          placeholder={help}
          className={`h-10 w-full rounded-lg border bg-core-elevated px-3 text-sm outline-none ${hasError ? 'border-core-danger' : 'border-core-border focus:border-core-accent'}`}
        />
      </div>
    </label>
  );
};

