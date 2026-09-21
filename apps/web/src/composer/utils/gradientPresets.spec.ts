import { describe, expect, it } from 'vitest';
import { GRADIENT_KINDS, makeGradient } from './fill';
import { applyGradientPreset, GRADIENT_PRESETS, presetsFor } from './gradientPresets';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The presets are the visible example of each gradient kind, so they are data
 * with a contract: icon-oriented, kind-appropriate and always a valid gradient.
 */
describe('gradient presets', () => {
  it('offers presets for every enabled kind', () => {
    for (const kind of GRADIENT_KINDS) {
      expect(GRADIENT_PRESETS[kind].length, kind).toBeGreaterThanOrEqual(3);
    }
  });

  it('every preset is a valid, ordered gradient', () => {
    for (const kind of GRADIENT_KINDS) {
      for (const preset of GRADIENT_PRESETS[kind]) {
        expect(preset.name.length, `${kind}/${preset.name}`).toBeGreaterThan(0);
        expect(preset.hint.length, `${kind}/${preset.name}`).toBeGreaterThan(0);
        expect(preset.stops.length, preset.name).toBeGreaterThanOrEqual(2);

        for (const stop of preset.stops) {
          expect(stop.color, preset.name).toMatch(HEX);
          expect(stop.offset).toBeGreaterThanOrEqual(0);
          expect(stop.offset).toBeLessThanOrEqual(1);
          if (stop.alpha !== undefined) {
            expect(stop.alpha).toBeGreaterThanOrEqual(0);
            expect(stop.alpha).toBeLessThanOrEqual(1);
          }
        }

        const offsets = preset.stops.map((stop) => stop.offset);
        expect([...offsets].sort((a, b) => a - b), preset.name).toEqual(offsets);
      }
    }
  });

  it('presets carry the geometry their kind actually uses', () => {
    expect(GRADIENT_PRESETS['linear-gradient'].every((preset) => preset.angle !== undefined)).toBe(true);
    expect(GRADIENT_PRESETS['angular-gradient'].every((preset) => preset.angle !== undefined)).toBe(true);

    for (const kind of ['radial-gradient', 'diamond-gradient'] as const) {
      expect(
        GRADIENT_PRESETS[kind].every(
          (preset) => preset.centerX !== undefined && preset.centerY !== undefined && preset.radius !== undefined
        ),
        kind
      ).toBe(true);
    }
  });

  it('applying a preset keeps the kind and applies stops plus geometry', () => {
    const linear = makeGradient(
      'linear-gradient',
      [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
      { angle: 20 }
    );
    const metal = GRADIENT_PRESETS['linear-gradient'][0];
    const appliedLinear = applyGradientPreset(linear, metal);

    expect(appliedLinear.kind).toBe('linear-gradient');
    expect(appliedLinear.stops).toEqual(metal.stops);
    expect((appliedLinear as { angle?: number }).angle).toBe(90);

    const radial = makeGradient('radial-gradient', [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }]);
    const highlight = GRADIENT_PRESETS['radial-gradient'][0];
    const appliedRadial = applyGradientPreset(radial, highlight);

    expect(appliedRadial).toMatchObject({ kind: 'radial-gradient', centerX: 0.32, centerY: 0.28, radius: 0.75 });
    expect(appliedRadial.stops).toEqual(highlight.stops);
  });

  it('never writes geometry the kind cannot use', () => {
    const radial = makeGradient('radial-gradient', [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }]);
    const applied = applyGradientPreset(radial, GRADIENT_PRESETS['linear-gradient'][0]);

    expect(applied.kind).toBe('radial-gradient');
    expect((applied as { angle?: number }).angle).toBeUndefined();
  });

  it('presetsFor returns the set for the fill kind', () => {
    const fill = makeGradient('angular-gradient', [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }]);
    expect(presetsFor(fill)).toBe(GRADIENT_PRESETS['angular-gradient']);
  });
});
