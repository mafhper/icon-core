import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { IconLayer } from '@iconcore/shared';
import { NumberField, Popover, Section, Slider, Switch } from '@iconcore/ui';
import { StudioColorPicker } from '../../studio/components/StudioColorPicker';
import type { ScopedLayerChanges } from '../utils/layerEdit';
import {
  effectPaint,
  getEffect,
  hasPaintedShadow,
  isGlassActive,
  isGlowActive,
  isNoiseActive,
  patchBackdropBlur,
  patchDropShadow,
  patchGlass,
  patchGlow,
  patchInnerShadow,
  patchLayerBlur,
  patchNoise,
  resolveBackdropBlur,
  resolveDropShadow,
  resolveGlass,
  resolveLayerBlur,
  resolveNoise,
  setBackdropBlurEnabled,
  setDropEnabled,
  setEffect,
  setGlassEnabled,
  setGlowEnabled,
  setLayerBlurEnabled,
  setNoiseEnabled,
  NOISE_SIZE_RANGE,
  SHADOW_SPREAD_RANGE
} from '../utils/layerStyle';

type EffectModal = 'drop' | 'inner' | 'blur' | 'glow' | 'backdrop' | 'glass' | 'noise';

/**
 * Move focus into an open effect modal (first tabbable surface), so keyboard
 * dismissal can return it — the same contract the floating colour picker
 * keeps. The move never scrolls: the panel sits next to its trigger and a
 * scroll on open would read as a viewport change and dismiss what just opened.
 */
const useModalFocus = (open: boolean, bodyRef: React.RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    if (!open) return;
    const focusFirst = () => {
      const body = bodyRef.current;
      const first = body?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (first ?? body)?.focus?.({ preventScroll: true });
    };
    if (typeof requestAnimationFrame !== 'function') {
      focusFirst();
      return;
    }
    const frame = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(frame);
  }, [open, bodyRef]);
};

interface LayerInspectorEffectsProps {
  layer: IconLayer;
  updateLayer: (changes: ScopedLayerChanges, transient?: boolean) => void;
  commit: () => void;
}

/**
 * Effects section: one row per effect, one modal at a time.
 *
 * Each row is a switch (the state) plus an edit button (the modal). Modal
 * edits report transiently and commit once — on slider release, on picker
 * commit, or on close, whichever comes first; closing a dirty modal confirms
 * instead of losing. A `pendingRef` tracks the uncommitted tail so close
 * never writes a duplicate history entry after a release already committed.
 *
 * The legacy depth shadow has no row: the Drop modal absorbed it. Old
 * projects still carry the entry and the engine still paints it untouched —
 * the Drop switch reads "a shadow paints" and enabling migrates its numbers.
 */
export const LayerInspectorEffects = ({ layer, updateLayer, commit }: LayerInspectorEffectsProps) => {
  const [openModal, setOpenModal] = useState<EffectModal | null>(null);
  const pendingRef = useRef(false);

  const touch = (changes: ScopedLayerChanges) => {
    pendingRef.current = true;
    updateLayer(changes, true);
  };
  const commitTouch = () => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    commit();
  };

  const dropAnchorRef = useRef<HTMLButtonElement>(null);
  const dropBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'drop', dropBodyRef);
  const innerAnchorRef = useRef<HTMLButtonElement>(null);
  const innerBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'inner', innerBodyRef);
  const blurAnchorRef = useRef<HTMLButtonElement>(null);
  const blurBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'blur', blurBodyRef);
  const backdropAnchorRef = useRef<HTMLButtonElement>(null);
  const backdropBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'backdrop', backdropBodyRef);
  const glassAnchorRef = useRef<HTMLButtonElement>(null);
  const glassBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'glass', glassBodyRef);
  const noiseAnchorRef = useRef<HTMLButtonElement>(null);
  const noiseBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'noise', noiseBodyRef);
  const glowAnchorRef = useRef<HTMLButtonElement>(null);
  const glowBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'glow', glowBodyRef);

  const closeModal = (
    bodyRef: React.RefObject<HTMLDivElement | null>,
    anchorRef: React.RefObject<HTMLButtonElement | null>
  ) => {
    // Focus returns to the trigger only when it was inside the panel
    // (keyboard dismissal): on an outside pointer dismissal focus is already
    // where the person put it and must not be stolen back.
    const focusInside = bodyRef.current?.contains(document.activeElement) ?? false;
    commitTouch();
    setOpenModal(null);
    if (focusInside) anchorRef.current?.focus();
  };
  const closeDropModal = () => closeModal(dropBodyRef, dropAnchorRef);
  const closeInnerModal = () => closeModal(innerBodyRef, innerAnchorRef);
  const closeBlurModal = () => closeModal(blurBodyRef, blurAnchorRef);
  const closeGlowModal = () => closeModal(glowBodyRef, glowAnchorRef);
  const closeBackdropModal = () => closeModal(backdropBodyRef, backdropAnchorRef);
  const closeGlassModal = () => closeModal(glassBodyRef, glassAnchorRef);
  const closeNoiseModal = () => closeModal(noiseBodyRef, noiseAnchorRef);

  const drop = resolveDropShadow(layer);
  const dropOn = hasPaintedShadow(layer);
  const blur = resolveLayerBlur(layer);
  const backdrop = resolveBackdropBlur(layer);
  const glass = resolveGlass(layer);
  const noise = resolveNoise(layer);

  const innerShadow = getEffect(layer, 'inner-shadow');
  const glowOn = isGlowActive(layer);
  const glow = resolveDropShadow(layer);

  return (
    <Section title="Effects">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Drop shadow"
            checked={dropOn}
            onChange={(event) => updateLayer({ effects: setDropEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={dropAnchorRef}
          aria-label="Edit Drop shadow"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'drop'}
          title="Edit Drop shadow"
          onClick={() => setOpenModal((was) => (was === 'drop' ? null : 'drop'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'drop' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'drop'}
        anchorRef={dropAnchorRef}
        onClose={closeDropModal}
        aria-label="Drop shadow settings"
      >
        <div ref={dropBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'drop' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <StudioColorPicker
                label="Drop shadow color"
                value={effectPaint(drop, 0.5)}
                onChange={(next) =>
                  touch({
                    effects: patchDropShadow(layer, { color: next.color, opacity: next.alpha })
                  })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Drop X"
                unit="px"
                min="-100"
                max="100"
                value={Number(drop.params.x ?? 0)}
                onChange={(event) =>
                  touch({ effects: patchDropShadow(layer, { x: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Drop Y"
                unit="px"
                min="-100"
                max="100"
                value={Number(drop.params.y ?? 8)}
                onChange={(event) =>
                  touch({ effects: patchDropShadow(layer, { y: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Drop blur"
                unit="px"
                min="0"
                max="80"
                value={Number(drop.params.blur ?? 16)}
                onChange={(event) =>
                  touch({ effects: patchDropShadow(layer, { blur: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Drop spread"
                unit="px"
                min={String(SHADOW_SPREAD_RANGE.min)}
                max={String(SHADOW_SPREAD_RANGE.max)}
                value={Number(drop.params.spread ?? 0)}
                onChange={(event) =>
                  touch({ effects: patchDropShadow(layer, { spread: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Glow"
            checked={glowOn}
            onChange={(event) => updateLayer({ effects: setGlowEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={glowAnchorRef}
          aria-label="Edit Glow"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'glow'}
          title="Edit Glow"
          onClick={() => setOpenModal((was) => (was === 'glow' ? null : 'glow'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'glow' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'glow'}
        anchorRef={glowAnchorRef}
        onClose={closeGlowModal}
        aria-label="Glow settings"
      >
        <div ref={glowBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'glow' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <StudioColorPicker
                label="Glow color"
                value={effectPaint(glow, 0.65)}
                onChange={(next) =>
                  touch({ effects: patchGlow(layer, { color: next.color, opacity: next.alpha }) })
                }
                onCommit={commitTouch}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField
                  label="Glow X (locked at 0)"
                  unit="px"
                  value={0}
                  disabled
                />
                <NumberField
                  label="Glow Y (locked at 0)"
                  unit="px"
                  value={0}
                  disabled
                />
              </div>
              <Slider
                variant="inline"
                label="Glow blur"
                unit="px"
                min="0"
                max="80"
                value={Number(glow.params.blur ?? 24)}
                onChange={(event) =>
                  touch({ effects: patchGlow(layer, { blur: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Inner shadow"
            checked={innerShadow.enabled}
            onChange={(event) => updateLayer({ effects: setEffect(layer, { ...innerShadow, enabled: event.target.checked }) })}
          />
        </div>
        <button
          type="button"
          ref={innerAnchorRef}
          aria-label="Edit Inner shadow"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'inner'}
          title="Edit Inner shadow"
          onClick={() => setOpenModal((was) => (was === 'inner' ? null : 'inner'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'inner' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'inner'}
        anchorRef={innerAnchorRef}
        onClose={closeInnerModal}
        aria-label="Inner shadow settings"
      >
        <div ref={innerBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'inner' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <StudioColorPicker
                label="Inner shadow color"
                value={effectPaint(innerShadow, 0.35)}
                onChange={(next) =>
                  touch({
                    effects: patchInnerShadow(layer, { color: next.color, opacity: next.alpha })
                  })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Inner X"
                unit="px"
                min="-100"
                max="100"
                value={Number(innerShadow.params.x ?? 0)}
                onChange={(event) =>
                  touch({ effects: patchInnerShadow(layer, { x: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Inner Y"
                unit="px"
                min="-100"
                max="100"
                value={Number(innerShadow.params.y ?? 6)}
                onChange={(event) =>
                  touch({ effects: patchInnerShadow(layer, { y: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Inner blur"
                unit="px"
                min="0"
                max="80"
                value={Number(innerShadow.params.blur ?? 12)}
                onChange={(event) =>
                  touch({ effects: patchInnerShadow(layer, { blur: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Inner spread"
                unit="px"
                min={String(SHADOW_SPREAD_RANGE.min)}
                max={String(SHADOW_SPREAD_RANGE.max)}
                value={Number(innerShadow.params.spread ?? 0)}
                onChange={(event) =>
                  touch({ effects: patchInnerShadow(layer, { spread: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Layer blur"
            checked={blur.enabled}
            onChange={(event) => updateLayer({ effects: setLayerBlurEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={blurAnchorRef}
          aria-label="Edit Layer blur"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'blur'}
          title="Edit Layer blur"
          onClick={() => setOpenModal((was) => (was === 'blur' ? null : 'blur'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'blur' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'blur'}
        anchorRef={blurAnchorRef}
        onClose={closeBlurModal}
        aria-label="Layer blur settings"
      >
        <div ref={blurBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'blur' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <Slider
                variant="inline"
                label="Blur radius"
                unit="px"
                min="0"
                max="60"
                value={blur.radius}
                onChange={(event) =>
                  touch({ effects: patchLayerBlur(layer, Number(event.target.value)) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Background blur"
            checked={backdrop.enabled && backdrop.radius > 0}
            onChange={(event) => updateLayer({ effects: setBackdropBlurEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={backdropAnchorRef}
          aria-label="Edit Background blur"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'backdrop'}
          title="Edit Background blur"
          onClick={() => setOpenModal((was) => (was === 'backdrop' ? null : 'backdrop'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'backdrop' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'backdrop'}
        anchorRef={backdropAnchorRef}
        onClose={closeBackdropModal}
        aria-label="Background blur settings"
      >
        <div ref={backdropBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'backdrop' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <Slider
                variant="inline"
                label="Background radius"
                unit="px"
                min="0"
                max="60"
                value={backdrop.radius}
                onChange={(event) =>
                  touch({ effects: patchBackdropBlur(layer, Number(event.target.value)) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Glass"
            checked={isGlassActive(layer)}
            onChange={(event) => updateLayer({ effects: setGlassEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={glassAnchorRef}
          aria-label="Edit Glass"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'glass'}
          title="Edit Glass"
          onClick={() => setOpenModal((was) => (was === 'glass' ? null : 'glass'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'glass' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'glass'}
        anchorRef={glassAnchorRef}
        onClose={closeGlassModal}
        aria-label="Glass settings"
      >
        <div ref={glassBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'glass' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <StudioColorPicker
                label="Glass tint"
                value={{ color: String(glass.params.tint ?? '#ffffff'), alpha: Number(glass.params.tintOpacity ?? 0.2) }}
                onChange={(next) =>
                  touch({
                    effects: patchGlass(layer, { tint: next.color, tintOpacity: next.alpha })
                  })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Glass blur"
                unit="px"
                min="0"
                max="60"
                value={Number(glass.params.blurRadius ?? 14)}
                onChange={(event) =>
                  touch({ effects: patchGlass(layer, { blurRadius: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Edge light"
                unit="%"
                min="0"
                max="100"
                value={Math.round(Number(glass.params.edgeHighlight ?? 0.6) * 100)}
                onChange={(event) =>
                  touch({ effects: patchGlass(layer, { edgeHighlight: Number(event.target.value) / 100 }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Frost"
                unit="%"
                min="0"
                max="100"
                value={Math.round(Number(glass.params.frost ?? 0.25) * 100)}
                onChange={(event) =>
                  touch({ effects: patchGlass(layer, { frost: Number(event.target.value) / 100 }) })
                }
                onCommit={commitTouch}
              />
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Switch
            label="Noise"
            checked={isNoiseActive(layer)}
            onChange={(event) => updateLayer({ effects: setNoiseEnabled(layer, event.target.checked) })}
          />
        </div>
        <button
          type="button"
          ref={noiseAnchorRef}
          aria-label="Edit Noise"
          aria-haspopup="dialog"
          aria-expanded={openModal === 'noise'}
          title="Edit Noise"
          onClick={() => setOpenModal((was) => (was === 'noise' ? null : 'noise'))}
          className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
        >
          <ChevronDown size={14} aria-hidden="true" className={openModal === 'noise' ? 'rotate-180' : ''} />
        </button>
      </div>
      <Popover
        open={openModal === 'noise'}
        anchorRef={noiseAnchorRef}
        onClose={closeNoiseModal}
        aria-label="Noise settings"
      >
        <div ref={noiseBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'noise' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <Slider
                variant="inline"
                label="Noise amount"
                unit="%"
                min="0"
                max="100"
                value={Math.round(Number(noise.params.amount ?? 0.3) * 100)}
                onChange={(event) =>
                  touch({ effects: patchNoise(layer, { amount: Number(event.target.value) / 100 }) })
                }
                onCommit={commitTouch}
              />
              <Slider
                variant="inline"
                label="Grain size"
                unit="px"
                min={String(NOISE_SIZE_RANGE.min)}
                max={String(NOISE_SIZE_RANGE.max)}
                value={Number(noise.params.size ?? 2)}
                onChange={(event) =>
                  touch({ effects: patchNoise(layer, { size: Number(event.target.value) }) })
                }
                onCommit={commitTouch}
              />
              <Switch
                label="Monochrome"
                checked={noise.params.monochrome === undefined ? true : Boolean(noise.params.monochrome)}
                onChange={(event) => touch({ effects: patchNoise(layer, { monochrome: event.target.checked }) })}
              />
            </div>
          )}
        </div>
      </Popover>
    </Section>
  );
};
