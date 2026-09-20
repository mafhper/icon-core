import { describe, expect, it } from 'vitest';
import { cn } from '../src/utils/cn';

describe('cn', () => {
  it('joins primitive class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values (clsx semantics)', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('accepts conditional objects', () => {
    expect(cn({ on: true, off: false }, 'base')).toBe('on base');
  });

  it('resolves tailwind conflicts in favor of the last class', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-600')).toBe('text-blue-600');
  });

  it('keeps distinct utilities when they do not conflict', () => {
    expect(cn('px-2', 'py-1', 'rounded-sm')).toBe('px-2 py-1 rounded-sm');
  });
});