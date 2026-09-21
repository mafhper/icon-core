import { describe, expect, it } from 'vitest';
import type { Fill, GradientFill, GradientStop } from '@iconcore/shared';
import { DEFAULT_SOLID_COLOR } from '../constants';
import { convertFillKind, isGradientFill, makeGradient, solidOf } from './fill';

const stopsOf = (fill: Fill): GradientStop[] => (fill as GradientFill).stops ?? [];

describe('convertFillKind', () => {
  it('returns the same fill when the kind does not change', () => {
    const solid: Fill = { kind: 'solid', color: '#abcdef' };
    expect(convertFillKind(solid, 'solid')).toBe(solid);
  });

  it('seeds the first stop with the current solid colour and alpha', () => {
    const next = convertFillKind({ kind: 'solid', color: '#112233', alpha: 0.5 }, 'linear-gradient');

    expect(next.kind).toBe('linear-gradient');
    expect(stopsOf(next)[0]).toMatchObject({ offset: 0, color: '#112233', alpha: 0.5 });
    expect(stopsOf(next).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the stops when only the gradient kind changes', () => {
    const stops: GradientStop[] = [
      { offset: 0, color: '#000000' },
      { offset: 0.25, color: '#888888' },
      { offset: 1, color: '#ffffff' }
    ];
    const radial = convertFillKind(makeGradient('linear-gradient', stops), 'radial-gradient');

    expect(radial.kind).toBe('radial-gradient');
    // `normalizeStops` fills in the default alpha, so compare the meaningful fields.
    expect(stopsOf(radial).map(({ offset, color }) => ({ offset, color }))).toEqual(stops);
  });

  it('carries the angle across linear ↔ angular', () => {
    const linear = makeGradient('linear-gradient', [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }], { angle: 42 });
    const angular = convertFillKind(linear, 'angular-gradient');

    expect(angular.kind).toBe('angular-gradient');
    expect((angular as { angle?: number }).angle).toBe(42);
  });

  it('carries centre and radius across radial ↔ diamond', () => {
    const radial = makeGradient('radial-gradient', [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }], {
      centerX: 0.2,
      centerY: 0.3,
      radius: 0.7
    });
    const diamond = convertFillKind(radial, 'diamond-gradient');

    expect(diamond).toMatchObject({ centerX: 0.2, centerY: 0.3, radius: 0.7 });
  });

  it('takes the first stop when going gradient → solid', () => {
    const radial = makeGradient('radial-gradient', [
      { offset: 0, color: '#ff0000', alpha: 0.25 },
      { offset: 1, color: '#00ff00' }
    ]);

    expect(convertFillKind(radial, 'solid')).toEqual({ kind: 'solid', color: '#ff0000', alpha: 0.25 });
  });

  it('falls back to the brand colour when leaving "none" or an empty fill', () => {
    expect(convertFillKind({ kind: 'none' }, 'solid').kind).toBe('solid');
    expect(convertFillKind(undefined, 'solid')).toEqual({ kind: 'solid', color: DEFAULT_SOLID_COLOR });
    expect(convertFillKind(undefined, 'linear-gradient').kind).toBe('linear-gradient');
  });

  it('maps any fill to none', () => {
    expect(convertFillKind({ kind: 'solid', color: '#ffffff' }, 'none')).toEqual({ kind: 'none' });
  });
});

describe('isGradientFill', () => {
  it('accepts the four gradient kinds only', () => {
    expect(isGradientFill({ kind: 'linear-gradient' })).toBe(true);
    expect(isGradientFill({ kind: 'diamond-gradient' })).toBe(true);
    expect(isGradientFill({ kind: 'solid', color: '#fff' })).toBe(false);
    expect(isGradientFill({ kind: 'none' })).toBe(false);
    expect(isGradientFill(undefined)).toBe(false);
  });
});

describe('solidOf', () => {
  it('reads solids directly and gradients from their first stop', () => {
    expect(solidOf({ kind: 'solid', color: '#010203', alpha: 0.4 })).toEqual({ color: '#010203', alpha: 0.4 });
    expect(
      solidOf(makeGradient('linear-gradient', [{ offset: 0, color: '#040506', alpha: 0.6 }, { offset: 1, color: '#ffffff' }]))
    ).toEqual({ color: '#040506', alpha: 0.6 });
    expect(solidOf(undefined)).toEqual({ color: '#ffffff', alpha: 1 });
  });
});
