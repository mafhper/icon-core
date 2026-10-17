import { describe, expect, it } from 'vitest';
import type { IconLayer, LayerEffect, ShapeKind } from '@iconcore/shared';
import { toRgba } from '@iconcore/renderer';
import { GLASS_DEFAULTS, GLOW_PRESET, NOISE_DEFAULTS, NOISE_SIZE_RANGE, SHADOW_SPREAD_RANGE, backdropBlurPx, borderRadiusForLayer, fillColor, fillToCss, getEffect, getShadow, isGlassActive, isGlowActive, isNoiseActive, legacyToDropParams, patchBackdropBlur, patchDropShadow, patchGlass, patchGlow, patchInnerShadow, patchNoise, resolveBackdropBlur, resolveDropShadow, resolveGlass, resolveNoise, setDropEnabled, setGlassEnabled, setGlowEnabled, setNoiseEnabled, setShadow, shadowCssForLayer } from './layerStyle';

const shapeLayer = (kind: ShapeKind, cornerRadius?: number): IconLayer => ({
  id: 'l',
  name: 'l',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind, width: 100, height: 100, cornerRadius } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1
});

describe('fillToCss', () => {
  it('handles missing fills, solids and gradients', () => {
    expect(fillToCss(undefined)).toBe('transparent');
    expect(fillToCss({ kind: 'none' })).toBe('transparent');
    expect(fillToCss({ kind: 'solid', color: '#abcdef' })).toBe('rgb(171, 205, 239)');
    expect(fillToCss({ kind: 'solid', color: '#abcdef', alpha: 0.5 })).toBe('rgba(171, 205, 239, 0.5)');
    expect(fillToCss({ kind: 'linear-gradient', angle: 90, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] }))
      .toBe('linear-gradient(90deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)');
    expect(fillToCss({ kind: 'radial-gradient', stops: [] })).toContain('radial-gradient(ellipse');
    expect(fillToCss({ kind: 'radial-gradient', stops: [], centerX: 0.25, centerY: 0.75 })).toContain('at 25% 75%');
    expect(fillToCss({ kind: 'angular-gradient', stops: [], angle: 45 })).toContain('conic-gradient(from 45deg');
  });
});

describe('fillColor', () => {
  it('extracts solid color and falls back for gradients', () => {
    expect(fillColor({ kind: 'solid', color: '#123456' })).toBe('#123456');
    expect(fillColor({ kind: 'linear-gradient' })).toBe('#111827');
    expect(fillColor(undefined)).toBe('#111827');
  });
});

describe('borderRadiusForLayer', () => {
  it('maps shape kinds to css radius', () => {
    expect(borderRadiusForLayer(shapeLayer('circle'))).toBe('999px');
    expect(borderRadiusForLayer(shapeLayer('squircle'))).toBe('28%');
    expect(borderRadiusForLayer(shapeLayer('rounded-rectangle', 12))).toBe('12px');
    expect(borderRadiusForLayer(shapeLayer('rectangle'))).toBe('0px');
  });
});

describe('shadow helpers', () => {
  it('returns a disabled default when no shadow effect exists', () => {
    const shadow = getShadow(shapeLayer('circle'));
    expect(shadow.enabled).toBe(false);
    expect(shadowCssForLayer(shapeLayer('circle'))).toBeUndefined();
  });

  it('upserts a depth-shadow effect and renders css when enabled', () => {
    const layer = shapeLayer('circle');
    const effects = setShadow(layer, { kind: 'depth-shadow', enabled: true, params: { x: 1, y: 2, blur: 4, color: '#000' } });
    expect(effects).toHaveLength(1);
    expect(shadowCssForLayer({ ...layer, effects })).toBe('1px 2px 4px #000');
  });
});

describe('D2 — absorção do depth-shadow legado pelo Drop shadow', () => {
  const legada = (params: Record<string, number | string> = {}): IconLayer => ({
    ...shapeLayer('circle'),
    effects: [
      {
        kind: 'depth-shadow',
        enabled: true,
        params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)', ...params }
      }
    ]
  });

  it('migra números e cor sem mover um pixel no canvas', () => {
    const legacy = legada().effects![0];
    const drop = legacyToDropParams(legacy);
    expect(drop.x).toBe(0);
    expect(drop.y).toBe(18);
    expect(drop.blur).toBe(34);
    // A tinta que o canvas pinta é a mesma string: aposentar o legado não move um pixel.
    expect(toRgba(String(drop.color), Number(drop.opacity))).toBe(String(legacy.params.color));
  });

  it('resolveDropShadow lê sem escrever: migrado desligado, legado intacto', () => {
    const layer = legada();
    const drop: LayerEffect = resolveDropShadow(layer);
    expect(drop).toMatchObject({ kind: 'drop-shadow', enabled: false });
    expect(drop.params.y).toBe(18);
    expect(layer.effects?.find((e) => e.kind === 'depth-shadow')?.enabled).toBe(true);
  });

  it('ligar aposenta o legado com params intactos; desligar apaga os dois sem destruir', () => {
    const ligada = setDropEnabled(legada(), true);
    expect(ligada.find((e) => e.kind === 'drop-shadow')).toMatchObject({ enabled: true, params: { y: 18 } });
    const legadoAposentado = ligada.find((e) => e.kind === 'depth-shadow');
    expect(legadoAposentado?.enabled).toBe(false);
    expect(legadoAposentado?.params.y).toBe(18);

    const desligada = setDropEnabled({ ...legada(), effects: ligada }, false);
    expect(desligada.filter((e) => e.enabled)).toHaveLength(0);
    expect(desligada.find((e) => e.kind === 'drop-shadow')?.params.y).toBe(18);
    expect(desligada.find((e) => e.kind === 'depth-shadow')?.params.y).toBe(18);
  });

  it('desligar sem drop somido não inventa entrada', () => {
    const desligada = setDropEnabled(legada(), false);
    expect(desligada.some((e) => e.kind === 'drop-shadow')).toBe(false);
    expect(desligada.find((e) => e.kind === 'depth-shadow')?.enabled).toBe(false);
  });
});

describe('Glow — preset e fileira', () => {
  const nua = (): IconLayer => ({
    ...shapeLayer('circle'),
    effects: []
  });

  it('preset inicial é o atual, aplicado do zero', () => {
    expect(setGlowEnabled(nua(), true)).toEqual([{ ...GLOW_PRESET }]);
  });

  it('sobre o drop ativo centra em vez de duplicar, mantendo blur e cor', () => {
    const layer: IconLayer = {
      ...nua(),
      effects: [
        { kind: 'drop-shadow', enabled: true, params: { x: 10, y: 18, blur: 34, color: '#0f172a', opacity: 0.28 } }
      ]
    };
    const ligada = setGlowEnabled(layer, true);
    expect(ligada.filter((e) => e.kind === 'drop-shadow')).toHaveLength(1);
    expect(ligada.find((e) => e.kind === 'drop-shadow')).toMatchObject({
      enabled: true,
      params: { x: 0, y: 0, blur: 34, color: '#0f172a' }
    });
    expect(isGlowActive({ ...layer, effects: ligada })).toBe(true);
  });

  it('patchGlow escreve blur e cor com offset zero, nunca outro valor', () => {
    const layer: IconLayer = {
      ...nua(),
      effects: [
        { kind: 'drop-shadow', enabled: true, params: { x: 10, y: 18, blur: 34, color: '#0f172a', opacity: 0.28 } }
      ]
    };
    const editada = patchGlow(layer, { blur: 32 });
    expect(editada.find((e) => e.kind === 'drop-shadow')).toMatchObject({
      enabled: true,
      params: { x: 0, y: 0, blur: 32 }
    });
  });

  it('desligar preserva os params', () => {
    const ligada = setGlowEnabled(nua(), true);
    const desligada = setGlowEnabled({ ...nua(), effects: ligada }, false);
    expect(desligada.find((e) => e.kind === 'drop-shadow')).toMatchObject({
      enabled: false,
      params: { x: 0, y: 0, blur: 24 }
    });
    expect(isGlowActive({ ...nua(), effects: desligada })).toBe(false);
  });
});

describe('Tier 2 (2.0) — spread aditivo em drop e inner', () => {
  it('defaults novos abrem em zero, o valor que o motor ja pinta', () => {
    expect(getEffect(shapeLayer('circle'), 'drop-shadow').params.spread).toBe(0);
    expect(getEffect(shapeLayer('circle'), 'inner-shadow').params.spread).toBe(0);
  });

  it('migracao legada carrega spread zero sem tocar nos numeros', () => {
    const legacy: LayerEffect = { kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' } };
    expect(legacyToDropParams(legacy).spread).toBe(0);
  });

  it('patch de spread preserva x/y/blur e materializa ligado', () => {
    const base = shapeLayer('circle');
    const drop = patchDropShadow(base, { spread: 12 });
    expect(drop.find((e) => e.kind === 'drop-shadow')).toMatchObject({ enabled: true, params: { spread: 12, x: 0, y: 8, blur: 16 } });
    const inner = patchInnerShadow(base, { spread: -6 });
    expect(inner.find((e) => e.kind === 'inner-shadow')).toMatchObject({ enabled: true, params: { spread: -6, x: 0, y: 6, blur: 12 } });
  });

  it('intervalo do slider provado: [-20, 20]', () => {
    expect(SHADOW_SPREAD_RANGE).toEqual({ min: -20, max: 20 });
  });
});

describe('Tier 2 (2.1) — backdrop-blur aditivo', () => {
  it('sem entrada abre desligado com default que age', () => {
    expect(resolveBackdropBlur(shapeLayer('circle'))).toEqual({ enabled: false, radius: 12 });
    expect(backdropBlurPx(shapeLayer('circle'))).toBe(0);
  });

  it('patch materializa ligado preservando o raio ao desligar', () => {
    const base = shapeLayer('circle');
    const ligado = patchBackdropBlur(base, 20);
    expect(ligado.find((e) => e.kind === 'backdrop-blur')).toMatchObject({ enabled: true, params: { radius: 20 } });
    expect(backdropBlurPx({ ...base, effects: ligado })).toBe(20);
  });
});

describe('Tier 2 (2.2) — glass v1 com cinco params exatos', () => {
  it('sem entrada abre desligado nos defaults de gosto', () => {
    const glass = resolveGlass(shapeLayer('circle'));
    expect(glass.enabled).toBe(false);
    expect(glass.params).toEqual({ ...GLASS_DEFAULTS });
    expect(Object.keys(glass.params).sort()).toEqual(
      ['blurRadius', 'edgeHighlight', 'frost', 'tint', 'tintOpacity'].sort()
    );
    expect(isGlassActive(shapeLayer('circle'))).toBe(false);
  });

  it('patch aceita só as cinco chaves e materializa ligado', () => {
    const base = shapeLayer('circle');
    const efeitos = patchGlass(base, { blurRadius: 20, frost: 0.5, resto: 1 } as never);
    const glass = efeitos.find((e) => e.kind === 'glass')!;
    expect(glass.enabled).toBe(true);
    expect(glass.params.blurRadius).toBe(20);
    expect(glass.params.frost).toBe(0.5);
    expect('resto' in glass.params).toBe(false);
    expect(isGlassActive({ ...base, effects: efeitos })).toBe(true);
  });

  it('tudo zerado lê OFF: nas duas pipelines, zero é desligado', () => {
    const zerado: IconLayer = {
      ...shapeLayer('circle'),
      effects: [{ kind: 'glass', enabled: true, params: { ...GLASS_DEFAULTS, tintOpacity: 0, blurRadius: 0, edgeHighlight: 0, frost: 0 } }]
    };
    expect(isGlassActive(zerado)).toBe(false);
  });

  it('desligar preserva os params', () => {
    const base = shapeLayer('circle');
    const ligada = setGlassEnabled(base, true);
    expect(isGlassActive({ ...base, effects: ligada })).toBe(true);
    const desligada = setGlassEnabled({ ...base, effects: ligada }, false);
    expect(desligada.find((e) => e.kind === 'glass')).toMatchObject({
      enabled: false,
      params: { ...GLASS_DEFAULTS }
    });
  });
});

describe('Tier 2 (2.3) — noise-grain com amount/size/monochrome', () => {
  it('sem entrada abre desligado nos defaults', () => {
    const noise = resolveNoise(shapeLayer('circle'));
    expect(noise.enabled).toBe(false);
    expect(noise.params).toEqual({ ...NOISE_DEFAULTS });
    expect(Object.keys(noise.params).sort()).toEqual(['amount', 'monochrome', 'size'].sort());
    expect(isNoiseActive(shapeLayer('circle'))).toBe(false);
  });

  it('patch aceita só as três chaves e materializa ligado', () => {
    const base = shapeLayer('circle');
    const efeitos = patchNoise(base, { amount: 0.7, monochrome: false, resto: 1 } as never);
    const noise = efeitos.find((e) => e.kind === 'noise-grain')!;
    expect(noise.enabled).toBe(true);
    expect(noise.params.amount).toBe(0.7);
    expect(noise.params.monochrome).toBe(false);
    expect('resto' in noise.params).toBe(false);
    expect(isNoiseActive({ ...base, effects: efeitos })).toBe(true);
  });

  it('amount zero lê OFF e o intervalo do grão é o provado', () => {
    const zerado: IconLayer = {
      ...shapeLayer('circle'),
      effects: [{ kind: 'noise-grain', enabled: true, params: { amount: 0, size: 2, monochrome: true } }]
    };
    expect(isNoiseActive(zerado)).toBe(false);
    expect(NOISE_SIZE_RANGE).toEqual({ min: 1, max: 8 });
  });

  it('desligar preserva os params', () => {
    const base = shapeLayer('circle');
    const ligada = setNoiseEnabled(base, true);
    const desligada = setNoiseEnabled({ ...base, effects: ligada }, false);
    expect(desligada.find((e) => e.kind === 'noise-grain')).toMatchObject({
      enabled: false,
      params: { ...NOISE_DEFAULTS }
    });
  });
});
