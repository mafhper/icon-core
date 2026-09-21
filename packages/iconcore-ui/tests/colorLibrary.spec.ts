import { describe, expect, it } from 'vitest';
import { ALL_PALETTES, COLOR_LIBRARY, DEFAULT_PALETTE_ID, findPalette } from '../src/library/colorLibrary';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The library is static data with a contract: recognised systems, browsable
 * palettes, valid colours. It is the starting point users see in every colour
 * field, so a broken entry is visible everywhere.
 */
describe('colour library', () => {
  it('ships the known systems', () => {
    expect(COLOR_LIBRARY.length).toBeGreaterThanOrEqual(3);
    const ids = COLOR_LIBRARY.map((system) => system.id);
    expect(ids).toContain('apple');
    expect(ids).toContain('material');
    expect(ids).toContain('tailwind');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every palette is browsable and purposeful', () => {
    for (const system of COLOR_LIBRARY) {
      expect(system.name.length).toBeGreaterThan(0);
      expect(system.source.length, system.id).toBeGreaterThan(0);
      expect(system.palettes.length, system.id).toBeGreaterThanOrEqual(2);

      for (const palette of system.palettes) {
        expect(palette.id.length, system.id).toBeGreaterThan(0);
        expect(palette.name.length, palette.id).toBeGreaterThan(0);
        expect(palette.purpose.length, palette.id).toBeGreaterThan(10);
        expect(palette.colors.length, palette.id).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('every colour is a valid, unique hex within its palette', () => {
    for (const palette of ALL_PALETTES) {
      for (const color of palette.colors) {
        expect(color, palette.id).toMatch(HEX);
      }
      expect(new Set(palette.colors).size, palette.id).toBe(palette.colors.length);
    }
  });

  it('palette ids are unique across systems and resolvable', () => {
    const ids = ALL_PALETTES.map((palette) => palette.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_PALETTE_ID.length).toBeGreaterThan(0);
    expect(findPalette(DEFAULT_PALETTE_ID)).toBeDefined();
    expect(findPalette('does-not-exist')).toBeUndefined();
  });
});
