import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import type { IconLayer } from '@iconcore/shared';
import { NumberField, Popover, Section, Slider, Switch } from '@iconcore/ui';
import { StudioColorPicker } from '../../studio/components/StudioColorPicker';
import type { ScopedLayerChanges } from '../utils/layerEdit';
import {
  effectPaint,
  getEffect,
  hasPaintedShadow,
  isBloomActive,
  isGlassActive,
  isGlowActive,
  isNoiseActive,
  patchBackdropBlur,
  patchBloom,
  patchDropShadow,
  patchGlass,
  patchGlow,
  patchInnerShadow,
  patchLayerBlur,
  patchNoise,
  resolveBackdropBlur,
  resolveBloom,
  resolveDropShadow,
  resolveGlass,
  resolveLayerBlur,
  resolveNoise,
  setBackdropBlurEnabled,
  setBloomEnabled,
  setDropEnabled,
  setEffect,
  setGlassEnabled,
  setGlowEnabled,
  setLayerBlurEnabled,
  setNoiseEnabled,
  BLOOM_BLUR_RANGE,
  BLOOM_INTENSITY_RANGE,
  NOISE_SIZE_RANGE,
  SHADOW_SPREAD_RANGE
} from '../utils/layerStyle';

type EffectModal = 'drop' | 'inner' | 'blur' | 'glow' | 'bloom' | 'backdrop' | 'glass' | 'noise';

interface EffectFieldsProps {
  layer: IconLayer;
  touch: (changes: ScopedLayerChanges) => void;
  commitTouch: () => void;
}

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

/* --- Shared field groups: one definition, two surfaces ------------------- */
/*
 * Each group below is the COMPLETE adjustment set for its effect — the same
 * controls the modal always had (colour+alpha, X, Y, blur, spread, radius,
 * glass/noise/bloom params). The chevron renders the group inline in the
 * sidebar; the edit button renders the SAME group in the floating modal.
 * Both read the same `layer` and write through the same `touch`/`commitTouch`,
 * so editing on one side reflects on the other by construction — there is a
 * single source of truth, never a mirrored copy.
 *
 * Every effect's full set fits inline (colour picker, sliders, switches are
 * all sidebar-native): no control needed inventing or reporting away.
 */

const DropShadowFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const drop = resolveDropShadow(layer);
  return (
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
  );
};

const GlowFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const glow = resolveDropShadow(layer);
  return (
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
  );
};

const BloomFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const bloom = resolveBloom(layer);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <StudioColorPicker
        label="Bloom color"
        value={effectPaint(bloom, 0.9)}
        onChange={(next) =>
          touch({ effects: patchBloom(layer, { color: next.color, opacity: next.alpha }) })
        }
        onCommit={commitTouch}
      />
      <Slider
        variant="inline"
        label="Bloom blur"
        unit="px"
        min={String(BLOOM_BLUR_RANGE.min)}
        max={String(BLOOM_BLUR_RANGE.max)}
        value={Number(bloom.params.blur ?? 18)}
        onChange={(event) =>
          touch({ effects: patchBloom(layer, { blur: Number(event.target.value) }) })
        }
        onCommit={commitTouch}
      />
      <Slider
        variant="inline"
        label="Bloom intensity"
        unit="×"
        step="1"
        min={String(BLOOM_INTENSITY_RANGE.min)}
        max={String(BLOOM_INTENSITY_RANGE.max)}
        value={Math.round(Number(bloom.params.intensity ?? 2))}
        onChange={(event) =>
          touch({ effects: patchBloom(layer, { intensity: Number(event.target.value) }) })
        }
        onCommit={commitTouch}
      />
    </div>
  );
};

const InnerShadowFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const innerShadow = getEffect(layer, 'inner-shadow');
  return (
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
  );
};

const LayerBlurFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const blur = resolveLayerBlur(layer);
  return (
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
  );
};

const BackdropBlurFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const backdrop = resolveBackdropBlur(layer);
  return (
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
  );
};

const GlassFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const glass = resolveGlass(layer);
  return (
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
  );
};

const NoiseFields = ({ layer, touch, commitTouch }: EffectFieldsProps) => {
  const noise = resolveNoise(layer);
  return (
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
  );
};

interface EffectRowHeaderProps {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  inlineOpen: boolean;
  onToggleInline: () => void;
  modalOpen: boolean;
  onOpenModal: () => void;
  modalAnchorRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * One effect row: the switch (the state), the chevron (the COMPLETE
 * adjustments inline in the sidebar) and the edit button (the same grouped
 * component in the floating modal). The chevron and the modal never hold
 * state — both render the shared field group above — so the two surfaces
 * cannot disagree.
 */
const EffectRowHeader = ({
  label,
  checked,
  onToggle,
  inlineOpen,
  onToggleInline,
  modalOpen,
  onOpenModal,
  modalAnchorRef
}: EffectRowHeaderProps) => (
  <div className="flex items-center gap-1">
    <div className="min-w-0 flex-1">
      <Switch
        label={label}
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
      />
    </div>
    <button
      type="button"
      aria-label={`${inlineOpen ? 'Collapse' : 'Expand'} ${label} settings`}
      aria-expanded={inlineOpen}
      title={`${inlineOpen ? 'Collapse' : 'Expand'} ${label} settings`}
      onClick={onToggleInline}
      className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
    >
      <ChevronDown size={14} aria-hidden="true" className={inlineOpen ? 'rotate-180' : ''} />
    </button>
    <button
      type="button"
      ref={modalAnchorRef}
      aria-label={`Edit ${label}`}
      aria-haspopup="dialog"
      aria-expanded={modalOpen}
      title={`Edit ${label}`}
      onClick={onOpenModal}
      className="shrink-0 rounded-[var(--ic-field-radius)] p-1 text-ic-text-muted hover:text-ic-text"
    >
      <Pencil size={14} aria-hidden="true" />
    </button>
  </div>
);

interface LayerInspectorEffectsProps {
  layer: IconLayer;
  updateLayer: (changes: ScopedLayerChanges, transient?: boolean) => void;
  commit: () => void;
}

/**
 * Effects section: one row per effect, inline expansion plus one modal.
 *
 * Each row is a switch (the state), a chevron (the complete adjustments
 * inline) and an edit button (the same grouped component in the floating
 * modal). Modal edits report transiently and commit once — on slider release,
 * on picker commit, or on close, whichever comes first; closing a dirty modal
 * confirms instead of losing. A `pendingRef` tracks the uncommitted tail so
 * close never writes a duplicate history entry after a release already
 * committed.
 *
 * The legacy depth shadow has no row: the Drop modal absorbed it. Old
 * projects still carry the entry and the engine still paints it untouched —
 * the Drop switch reads "a shadow paints" and enabling migrates its numbers.
 */
export const LayerInspectorEffects = ({ layer, updateLayer, commit }: LayerInspectorEffectsProps) => {
  const [openModal, setOpenModal] = useState<EffectModal | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<EffectModal>>(new Set());
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

  const toggleInline = (id: EffectModal) => {
    setExpanded((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleModal = (id: EffectModal) => {
    setOpenModal((was) => (was === id ? null : id));
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
  const bloomAnchorRef = useRef<HTMLButtonElement>(null);
  const bloomBodyRef = useRef<HTMLDivElement>(null);
  useModalFocus(openModal === 'bloom', bloomBodyRef);

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
  const closeBloomModal = () => closeModal(bloomBodyRef, bloomAnchorRef);
  const closeBackdropModal = () => closeModal(backdropBodyRef, backdropAnchorRef);
  const closeGlassModal = () => closeModal(glassBodyRef, glassAnchorRef);
  const closeNoiseModal = () => closeModal(noiseBodyRef, noiseAnchorRef);

  const dropOn = hasPaintedShadow(layer);
  const blur = resolveLayerBlur(layer);
  const backdrop = resolveBackdropBlur(layer);

  const innerShadow = getEffect(layer, 'inner-shadow');
  const glowOn = isGlowActive(layer);
  const bloomOn = isBloomActive(layer);

  const fields: EffectFieldsProps = { layer, touch, commitTouch };

  return (
    <Section title="Effects">
      <EffectRowHeader
        label="Drop shadow"
        checked={dropOn}
        onToggle={(checked) => updateLayer({ effects: setDropEnabled(layer, checked) })}
        inlineOpen={expanded.has('drop')}
        onToggleInline={() => toggleInline('drop')}
        modalOpen={openModal === 'drop'}
        onOpenModal={() => toggleModal('drop')}
        modalAnchorRef={dropAnchorRef}
      />
      {expanded.has('drop') && (
        <div className="ic-effect-inline">
          <DropShadowFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'drop'}
        anchorRef={dropAnchorRef}
        onClose={closeDropModal}
        aria-label="Drop shadow settings"
      >
        <div ref={dropBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'drop' && <DropShadowFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Glow"
        checked={glowOn}
        onToggle={(checked) => updateLayer({ effects: setGlowEnabled(layer, checked) })}
        inlineOpen={expanded.has('glow')}
        onToggleInline={() => toggleInline('glow')}
        modalOpen={openModal === 'glow'}
        onOpenModal={() => toggleModal('glow')}
        modalAnchorRef={glowAnchorRef}
      />
      {expanded.has('glow') && (
        <div className="ic-effect-inline">
          <GlowFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'glow'}
        anchorRef={glowAnchorRef}
        onClose={closeGlowModal}
        aria-label="Glow settings"
      >
        <div ref={glowBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'glow' && <GlowFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Bloom"
        checked={bloomOn}
        onToggle={(checked) => updateLayer({ effects: setBloomEnabled(layer, checked) })}
        inlineOpen={expanded.has('bloom')}
        onToggleInline={() => toggleInline('bloom')}
        modalOpen={openModal === 'bloom'}
        onOpenModal={() => toggleModal('bloom')}
        modalAnchorRef={bloomAnchorRef}
      />
      {expanded.has('bloom') && (
        <div className="ic-effect-inline">
          <BloomFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'bloom'}
        anchorRef={bloomAnchorRef}
        onClose={closeBloomModal}
        aria-label="Bloom settings"
      >
        <div ref={bloomBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'bloom' && <BloomFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Inner shadow"
        checked={innerShadow.enabled}
        onToggle={(checked) => updateLayer({ effects: setEffect(layer, { ...innerShadow, enabled: checked }) })}
        inlineOpen={expanded.has('inner')}
        onToggleInline={() => toggleInline('inner')}
        modalOpen={openModal === 'inner'}
        onOpenModal={() => toggleModal('inner')}
        modalAnchorRef={innerAnchorRef}
      />
      {expanded.has('inner') && (
        <div className="ic-effect-inline">
          <InnerShadowFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'inner'}
        anchorRef={innerAnchorRef}
        onClose={closeInnerModal}
        aria-label="Inner shadow settings"
      >
        <div ref={innerBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'inner' && <InnerShadowFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Layer blur"
        checked={blur.enabled}
        onToggle={(checked) => updateLayer({ effects: setLayerBlurEnabled(layer, checked) })}
        inlineOpen={expanded.has('blur')}
        onToggleInline={() => toggleInline('blur')}
        modalOpen={openModal === 'blur'}
        onOpenModal={() => toggleModal('blur')}
        modalAnchorRef={blurAnchorRef}
      />
      {expanded.has('blur') && (
        <div className="ic-effect-inline">
          <LayerBlurFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'blur'}
        anchorRef={blurAnchorRef}
        onClose={closeBlurModal}
        aria-label="Layer blur settings"
      >
        <div ref={blurBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'blur' && <LayerBlurFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Background blur"
        checked={backdrop.enabled && backdrop.radius > 0}
        onToggle={(checked) => updateLayer({ effects: setBackdropBlurEnabled(layer, checked) })}
        inlineOpen={expanded.has('backdrop')}
        onToggleInline={() => toggleInline('backdrop')}
        modalOpen={openModal === 'backdrop'}
        onOpenModal={() => toggleModal('backdrop')}
        modalAnchorRef={backdropAnchorRef}
      />
      {expanded.has('backdrop') && (
        <div className="ic-effect-inline">
          <BackdropBlurFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'backdrop'}
        anchorRef={backdropAnchorRef}
        onClose={closeBackdropModal}
        aria-label="Background blur settings"
      >
        <div ref={backdropBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'backdrop' && <BackdropBlurFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Glass"
        checked={isGlassActive(layer)}
        onToggle={(checked) => updateLayer({ effects: setGlassEnabled(layer, checked) })}
        inlineOpen={expanded.has('glass')}
        onToggleInline={() => toggleInline('glass')}
        modalOpen={openModal === 'glass'}
        onOpenModal={() => toggleModal('glass')}
        modalAnchorRef={glassAnchorRef}
      />
      {expanded.has('glass') && (
        <div className="ic-effect-inline">
          <GlassFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'glass'}
        anchorRef={glassAnchorRef}
        onClose={closeGlassModal}
        aria-label="Glass settings"
      >
        <div ref={glassBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'glass' && <GlassFields {...fields} />}
        </div>
      </Popover>

      <EffectRowHeader
        label="Noise"
        checked={isNoiseActive(layer)}
        onToggle={(checked) => updateLayer({ effects: setNoiseEnabled(layer, checked) })}
        inlineOpen={expanded.has('noise')}
        onToggleInline={() => toggleInline('noise')}
        modalOpen={openModal === 'noise'}
        onOpenModal={() => toggleModal('noise')}
        modalAnchorRef={noiseAnchorRef}
      />
      {expanded.has('noise') && (
        <div className="ic-effect-inline">
          <NoiseFields {...fields} />
        </div>
      )}
      <Popover
        open={openModal === 'noise'}
        anchorRef={noiseAnchorRef}
        onClose={closeNoiseModal}
        aria-label="Noise settings"
      >
        <div ref={noiseBodyRef} tabIndex={-1} className="outline-none">
          {openModal === 'noise' && <NoiseFields {...fields} />}
        </div>
      </Popover>
    </Section>
  );
};
