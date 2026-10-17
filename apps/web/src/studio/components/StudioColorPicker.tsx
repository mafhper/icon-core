import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover } from '@iconcore/ui';
import {
  formatColor,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHex,
  parseColorField,
  type PickerFormat
} from '../colorMath';

export interface StudioColorValue {
  /** `#rrggbb`. */
  color: string;
  /** 0..1. */
  alpha: number;
}

interface StudioColorPickerProps {
  label: string;
  value: StudioColorValue;
  onChange: (value: StudioColorValue, transient?: boolean) => void;
  onCommit?: () => void;
  disabled?: boolean;
  /**
   * Stroke carries no alpha channel: hide the alpha controls instead of
   * editing a value the document cannot store.
   */
  showAlpha?: boolean;
}

const FORMATS: PickerFormat[] = ['hex', 'rgb', 'hsl', 'hsb'];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Studio colour picker (Fase 4): OpenPencil-shaped, HSV-hearted.
 *
 * A 2D saturation/brightness area at the current hue, hue and alpha sliders,
 * and one value field whose format switches between hex, rgb, hsl and hsb —
 * the four dialects the parity study names, all computed from the single
 * `colorMath` core, with no OKHCL and (ground-0) no recents or library.
 *
 * The header row keeps the kit's `ColorField` contract (`Choose X`, `X hex`,
 * `X alpha percent`), so the swap inside `FillEditor` changes the picker,
 * never the callers. Drags report transiently and commit on release: one
 * gesture, one history entry, like the canvas transactions.
 *
 * Two triggers, one body: the chevron expands the body inline in the sidebar
 * (the Fase 4 behaviour), while the colour swatch opens the same body in a
 * floating `Popover` anchored to the swatch (OpenPencil parity). The two are
 * exclusive — opening one closes the other. The floating panel dismisses on
 * Escape, outside click and viewport change, moves focus in on open and back
 * to the swatch on keyboard dismissal; continuous edits (drags, typing) never
 * dismiss, only an explicit Enter in the value field confirms and closes.
 */
export const StudioColorPicker = ({
  label,
  value,
  onChange,
  onCommit,
  disabled = false,
  showAlpha = true
}: StudioColorPickerProps) => {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const popoverBodyRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<PickerFormat>('hex');
  const [draft, setDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const hex = normalizeHex(value.color) ?? '#000000';
  const hsv = hexToHsv(hex) ?? { h: 0, s: 0, v: 0 };
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const alphaPct = Math.round(value.alpha * 100);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseColorField(draft, format);
    if (parsed) onChange({ ...value, color: parsed });
    setDraft(null);
    onCommit?.();
  };

  /**
   * Explicit confirmation inside the floating panel (Enter in the value
   * field): commit exactly like inline, then dismiss and return focus to the
   * swatch that opened it. Drags and typing never dismiss — only this
   * deliberate take-this-colour does.
   */
  const commitValueField = (dismissAfter: boolean) => {
    commitDraft();
    if (!dismissAfter) return;
    setPopoverOpen(false);
    swatchRef.current?.focus();
  };

  /**
   * Every `Popover` dismissal path (outside click, Escape, viewport change)
   * funnels here. Focus returns to the swatch only when it was inside the
   * panel (keyboard dismissal): on an outside pointer dismissal focus is
   * already where the person put it and must not be stolen back.
   */
  const handlePopoverClose = useCallback(() => {
    const focusInside = popoverBodyRef.current?.contains(document.activeElement) ?? false;
    setPopoverOpen(false);
    if (focusInside) swatchRef.current?.focus();
  }, []);

  // Floating-panel focus contract: move into the panel on open (the S/V area
  // group is the first tabbable surface), so keyboard dismissal can return.
  useEffect(() => {
    if (!popoverOpen) return;
    const focusFirst = () => {
      const body = popoverBodyRef.current;
      const first = body?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (first ?? body)?.focus?.();
    };
    if (typeof requestAnimationFrame !== 'function') {
      focusFirst();
      return;
    }
    const frame = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(frame);
  }, [popoverOpen]);

  const setFromHsv = (h: number, s: number, v: number, transient: boolean) => {
    onChange(
      {
        ...value,
        color: hsvToHex({
          h: ((h % 360) + 360) % 360,
          s: clamp01(s),
          v: clamp01(v)
        })
      },
      transient
    );
  };

  const areaPointer = (clientX: number, clientY: number, transient: boolean) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setFromHsv(
      hsv.h,
      (clientX - rect.left) / rect.width,
      1 - (clientY - rect.top) / rect.height,
      transient
    );
  };

  const onAreaKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') setFromHsv(hsv.h, hsv.s - step, hsv.v, false);
    else if (event.key === 'ArrowRight') setFromHsv(hsv.h, hsv.s + step, hsv.v, false);
    else if (event.key === 'ArrowUp') setFromHsv(hsv.h, hsv.s, hsv.v + step, false);
    else if (event.key === 'ArrowDown') setFromHsv(hsv.h, hsv.s, hsv.v - step, false);
    else return;
    event.preventDefault();
    onCommit?.();
  };

  const hueCss = `hsl(${Math.round(hsv.h)}, 100%, 50%)`;
  const paintCss = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${showAlpha ? value.alpha : 1})`;

  /**
   * The OpenPencil surface itself (S/V area, hue/alpha sliders, format
   * fields): one definition, shown either embedded (chevron) or floating
   * (swatch popover). `inPopover` only changes the value field's Enter key,
   * which confirms and dismisses the floating panel.
   */
  const renderPickerBody = (inPopover: boolean) => (
    <div className="studio-picker-body">
      <div
        ref={areaRef}
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label} saturation and brightness. Arrow keys adjust.`}
        className="studio-picker-satval"
        style={{ backgroundColor: hueCss }}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          areaPointer(event.clientX, event.clientY, true);
        }}
        onPointerMove={(event) => {
          if (disabled || !event.buttons) return;
          areaPointer(event.clientX, event.clientY, true);
        }}
        onPointerUp={() => onCommit?.()}
        onKeyDown={onAreaKey}
      >
        <div
          className="absolute inset-0 rounded-[8px]"
          style={{ background: 'linear-gradient(to right, rgb(255 255 255), transparent)' }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 rounded-[8px]"
          style={{ background: 'linear-gradient(to top, rgb(0 0 0), transparent)' }}
          aria-hidden="true"
        />
        <span
          className="studio-picker-cursor"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="studio-picker-sliders">
        <div
          role="group"
          aria-label={`${label} hue`}
          className="studio-picker-hue"
        >
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={Math.round(hsv.h)}
            disabled={disabled}
            aria-label={`${label} hue`}
            onChange={(event) => setFromHsv(Number(event.target.value), hsv.s, hsv.v, true)}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="h-full w-full cursor-ew-resize opacity-0"
          />
          <span
            className="studio-picker-thumb"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueCss }}
            aria-hidden="true"
          />
        </div>
        {showAlpha && (
          <div className="studio-picker-alpha" role="group" aria-label={`${label} alpha`}>
            <div
              className="studio-checker absolute inset-0 rounded-[6px]"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-[6px]"
              style={{
                background: `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1))`
              }}
              aria-hidden="true"
            />
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={alphaPct}
              disabled={disabled}
              aria-label={`${label} alpha`}
              onChange={(event) => onChange({ ...value, alpha: clamp01(Number(event.target.value) / 100) }, true)}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
              className="relative h-full w-full cursor-ew-resize opacity-0"
            />
            <span
              className="studio-picker-thumb"
              style={{ left: `${alphaPct}%`, background: paintCss }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <div className="studio-picker-formats">
        <label className="studio-picker-format-label">
          Format
          <select
            aria-label={`${label} format`}
            value={format}
            disabled={disabled}
            onChange={(event) => {
              setFormat(event.target.value as PickerFormat);
              setDraft(null);
            }}
            className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
          >
            {FORMATS.map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="studio-picker-format-label">
          Value
          <input
            value={draft ?? formatColor(hex, format)}
            disabled={disabled}
            aria-label={`${label} ${format} value`}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setDraft(event.target.value);
              const parsed = parseColorField(event.target.value, format);
              if (parsed) onChange({ ...value, color: parsed }, true);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitValueField(inPopover);
              if (event.key === 'Escape') setDraft(null);
            }}
            className="h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 py-0 font-mono text-[0.75rem] text-ic-text outline-none hover:bg-ic-overlay focus:border-ic-accent disabled:opacity-40"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="studio-picker">
      <div className="flex h-[var(--ic-control-md)] min-w-0 flex-1 items-center overflow-hidden rounded-[var(--ic-field-radius)] bg-ic-elevated hover:bg-ic-overlay focus-within:ring-1 focus-within:ring-ic-accent-ring">
        <button
          type="button"
          ref={swatchRef}
          disabled={disabled}
          aria-label={`Choose ${label} color`}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          title={`Choose ${label} color`}
          onClick={() => {
            // The floating trigger: the same body as the chevron, portalled
            // next to the swatch. Exclusive with the inline body below.
            if (popoverOpen) setPopoverOpen(false);
            else {
              setInlineOpen(false);
              setPopoverOpen(true);
            }
          }}
          className={`studio-checker ml-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-ic-border ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
        >
          <span className="block h-full w-full rounded-[3px]" style={{ background: paintCss }} />
        </button>
        <span className="select-none pl-1 font-mono text-ic-text-muted">#</span>
        <input
          value={hexDraft ?? hex.slice(1).toUpperCase()}
          disabled={disabled}
          aria-label={`${label} hex`}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            // A text draft while typing, like NumberField: clearing the field
            // must not write back before the value is a colour.
            setHexDraft(event.target.value);
            const parsed = normalizeHex(event.target.value);
            if (parsed) onChange({ ...value, color: parsed }, true);
          }}
          onBlur={() => {
            setHexDraft(null);
            onCommit?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setHexDraft(null);
              onCommit?.();
            }
          }}
          className="min-w-0 flex-1 rounded-none bg-transparent p-0 font-mono text-[length:var(--ic-control-font-size)] uppercase text-ic-text outline-none disabled:opacity-40"
        />
        {showAlpha && (
          <>
            <span className="h-4 w-px shrink-0 bg-ic-border" />
            <input
              type="number"
              min="0"
              max="100"
              value={alphaDraft ?? String(alphaPct)}
              disabled={disabled}
              aria-label={`${label} alpha percent`}
              onChange={(event) => {
                setAlphaDraft(event.target.value);
                if (event.target.value.trim() === '') return;
                const next = Number(event.target.value);
                if (Number.isFinite(next)) onChange({ ...value, alpha: clamp01(next / 100) }, true);
              }}
              onBlur={() => {
                setAlphaDraft(null);
                onCommit?.();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setAlphaDraft(null);
                  onCommit?.();
                }
              }}
              className="w-8 shrink-0 rounded-none bg-transparent p-0 text-right tabular-nums text-[length:var(--ic-control-font-size)] text-ic-text outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
            />
            <span className="select-none pr-1 text-ic-text-muted">%</span>
          </>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={`${inlineOpen ? 'Collapse' : 'Expand'} ${label} picker`}
          aria-expanded={inlineOpen}
          onClick={() => {
            // The inline trigger: the body stays embedded in the sidebar, as
            // since Fase 4. Exclusive with the floating swatch panel.
            if (!inlineOpen) setPopoverOpen(false);
            setInlineOpen((was) => !was);
          }}
          className="shrink-0 p-1 text-ic-text-muted hover:text-ic-text disabled:opacity-40"
        >
          <ChevronDown size={14} aria-hidden="true" className={inlineOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {inlineOpen && renderPickerBody(false)}

      <Popover
        open={popoverOpen}
        anchorRef={swatchRef}
        onClose={handlePopoverClose}
        width={300}
        estimatedHeight={380}
        aria-label={`${label} picker`}
      >
        <div ref={popoverBodyRef} tabIndex={-1} className="outline-none">
          {popoverOpen && renderPickerBody(true)}
        </div>
      </Popover>
    </div>
  );
};
