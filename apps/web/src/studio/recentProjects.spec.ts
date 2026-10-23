import { describe, expect, it } from 'vitest';
import { pickRecents, RECENTS_LIMIT } from './recentProjects';

const pointer = (id: string, updatedAt: number) => ({ id, name: id.toUpperCase(), updatedAt });

describe('pickRecents (Arquivo → Recentes)', () => {
  it('orders newest first and caps the menu at five', () => {
    // The insertion order is deliberately not the recency order: the menu's
    // contract is its own, not whatever order the list arrives in.
    const pool = [
      pointer('b', 20),
      pointer('a', 10),
      pointer('e', 50),
      pointer('c', 30),
      pointer('d', 40),
      pointer('f', 60)
    ];

    expect(pickRecents(pool).map((project) => project.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(RECENTS_LIMIT).toBe(5);
  });

  it('keeps a shorter list whole and does not mutate the input', () => {
    const pool = [pointer('old', 1), pointer('new', 9), pointer('mid', 5)];
    const original = [...pool];

    expect(pickRecents(pool).map((project) => project.id)).toEqual(['new', 'mid', 'old']);
    expect(pool).toEqual(original);
  });

  it('answers an empty list with an empty list', () => {
    expect(pickRecents([])).toEqual([]);
  });
});
