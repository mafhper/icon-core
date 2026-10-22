import { describe, expect, it } from 'vitest';

import { resolveDarkTheme } from './appearance';

describe('page theme resolution', () => {
  it('follows the system preference for the default appearance', () => {
    expect(resolveDarkTheme('default', true)).toBe(true);
    expect(resolveDarkTheme('default', false)).toBe(false);
  });

  it('keeps an explicit appearance, whatever the system preference says', () => {
    expect(resolveDarkTheme('dark', false)).toBe(true);
    expect(resolveDarkTheme('light', true)).toBe(false);
    expect(resolveDarkTheme('mono', true)).toBe(false);
  });
});
