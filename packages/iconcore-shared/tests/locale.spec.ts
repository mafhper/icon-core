import { describe, expect, it } from 'vitest';
import { detectLocale } from '../src/index';

describe('detectLocale', () => {
  it('defaults to en-US', () => {
    expect(detectLocale('')).toBe('en-US');
  });

  it('maps en locale', () => {
    expect(detectLocale('en-US')).toBe('en-US');
  });

  it('maps es locale', () => {
    expect(detectLocale('es-AR')).toBe('es-ES');
  });
});
