import { describe, expect, it } from 'vitest';

import { APPEARANCES, pagePresetFor, type ShaderPreset } from './appearance';
import { FRAGMENT_SRC, shaderFallbackBackground } from './shader';

const preset = (over: Partial<ShaderPreset> = {}): ShaderPreset => ({
  base: [0, 0, 0],
  c1: [1, 1, 1],
  c2: [0.5, 0.5, 0.5],
  c3: [0, 0, 0],
  iri: 0,
  light: 0,
  grain: 0,
  scale: 1,
  sat: 1,
  vig: 0,
  flow: 1,
  warp: 1,
  detail: 0,
  ...over,
});

describe('shader fallback', () => {
  it('paints the preset chroma as a CSS gradient, rounding channels to 0-255', () => {
    expect(shaderFallbackBackground(preset())).toBe(
      'radial-gradient(circle at 50% 38%, rgb(128 128 128), rgb(255 255 255) 45%, rgb(0 0 0))'
    );
  });

  it('keeps each color in its own channel', () => {
    expect(
      shaderFallbackBackground(
        preset({ base: [1, 0, 0], c1: [0, 0.2, 0.4], c2: [0.6, 0.8, 1] })
      )
    ).toBe(
      'radial-gradient(circle at 50% 38%, rgb(153 204 255), rgb(0 51 102) 45%, rgb(255 0 0))'
    );
  });

  it('still tells the appearances apart when WebGL is unavailable', () => {
    // No GL means no field: the only thing left to carry the appearance is this gradient.
    const gradients = APPEARANCES.map(({ id }) => shaderFallbackBackground(pagePresetFor(id, false)));

    expect(new Set(gradients).size).toBe(APPEARANCES.length);
  });
});

describe('shader motion channels', () => {
  const declared = [...FRAGMENT_SRC.matchAll(/uniform float (u_\w+);/g)].map((match) => match[1]);

  it('declares the appearance-driven shape channels', () => {
    for (const name of ['u_warp', 'u_detail']) expect(declared, name).toContain(name);
  });

  it('reads each one, because a declared-but-unused uniform is dropped by the compiler', () => {
    for (const name of ['u_warp', 'u_detail']) {
      expect(FRAGMENT_SRC.split(name).length - 1, `${name} is only declared`).toBeGreaterThan(1);
    }
  });
});
