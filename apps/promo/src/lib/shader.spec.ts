import { describe, expect, it } from 'vitest';

import type { ShaderPreset } from './appearance';
import { shaderFallbackBackground } from './shader';

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
});
