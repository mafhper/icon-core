import { describe, expect, it } from 'vitest';

import { saveProject, describeSaveOutcome, type SaveOutcome } from './projectStorage';

/**
 * The autosave writes `JSON.stringify(project)`, and a layer's source is the
 * image as base64 — roughly 4/3 its binary size. So "does my project fit" is
 * arithmetic, and the interesting behaviour is what happens when it stops
 * fitting.
 *
 * Measured in Chromium: the budget is 5.101 KB for this payload, and a
 * `QuotaExceededError` at layer 31 leaves the **previous good value in place**
 * (`localStorage.getItem` still returned 5.101 KB, not 0). So there is no data
 * loss — the failure is silent, and the user keeps believing their work is
 * saved. That is the defect this module exists to remove.
 */

/**
 * A stand-in for `localStorage`: the interface is `setItem`, not `Map.set`, and
 * a store with a finite budget throws a quota error instead of growing. A `Map`
 * passed directly fails every "saved" case for the wrong reason, which is how a
 * broken fixture can be mistaken for a broken implementation.
 */
class FakeStore {
  private readonly dados = new Map<string, string>();

  constructor(private readonly orcamento = Number.POSITIVE_INFINITY) {}

  getItem(chave: string): string | null {
    return this.dados.get(chave) ?? null;
  }

  setItem(chave: string, valor: string): void {
    if (valor.length > this.orcamento) {
      throw new DOMException('quota', 'QuotaExceededError');
    }
    this.dados.set(chave, valor);
  }

  removeItem(chave: string): void {
    this.dados.delete(chave);
  }
}

describe('saveProject', () => {
  it('stores the payload and reports it wrote', () => {
    const store = new FakeStore();

    const outcome = saveProject(store, 'k', { schemaVersion: 3, layers: [] });

    expect(outcome.kind).toBe<SaveOutcome['kind']>('saved');
    expect(store.getItem('k')).toBe(JSON.stringify({ schemaVersion: 3, layers: [] }));
  });

  it('keeps the previous value when the store is full', () => {
    // The measured failure mode: the last good save is still there afterwards,
    // which is what makes this recoverable rather than destructive.
    const store = new FakeStore(200);
    store.setItem('k', JSON.stringify({ schemaVersion: 3, layers: [{ id: 'antes' }] }));
    const anterior = store.getItem('k');

    const outcome = saveProject(store, 'k', { schemaVersion: 3, layers: new Array(20).fill({ id: 'x' }) });

    expect(outcome.kind).toBe<SaveOutcome['kind']>('quota-exceeded');
    expect(store.getItem('k')).toBe(anterior);
  });

  it('reports how much did not fit, so the message can be specific', () => {
    const store = new FakeStore(1024);
    // 200 layers ≈ 2.230 chars, comfortably over a 1.024 budget.
    const grande = { schemaVersion: 3, layers: new Array(200).fill({ id: 'x' }) };

    const outcome = saveProject(store, 'k', grande, { budget: 1024 });

    expect(outcome.kind).toBe<SaveOutcome['kind']>('quota-exceeded');
    if (outcome.kind !== 'quota-exceeded') throw new Error('esperado quota-exceeded');
    expect(outcome.payloadBytes).toBeGreaterThan(1024);
    expect(outcome.overshootBytes).toBe(outcome.payloadBytes - 1024);
  });

  it('reports no overflow rather than inventing one when the budget is unknown', () => {
    // The store refuses on its own terms, and its real quota may be smaller than
    // ours. Claiming "0 bytes over" would be wrong; claiming a fabricated figure
    // would be worse.
    const store = new FakeStore(1024);
    const grande = { schemaVersion: 3, layers: new Array(200).fill({ id: 'x' }) };

    const outcome = saveProject(store, 'k', grande);

    if (outcome.kind !== 'quota-exceeded') throw new Error('esperado quota-exceeded');
    expect(outcome.overshootBytes).toBe(0);
  });

  it('counts the payload the way the browser will', () => {
    const store = new FakeStore();

    const outcome = saveProject(store, 'k', { schemaVersion: 3, layers: [{ id: 'a' }] });

    if (outcome.kind !== 'saved') throw new Error('esperado saved');
    expect(outcome.payloadBytes).toBe(JSON.stringify({ schemaVersion: 3, layers: [{ id: 'a' }] }).length);
  });

  it('reports an unavailable store rather than throwing', () => {
    // Private-mode Safari and a blocked storage partition both make every write
    // throw. The autosave runs in a timer, so an exception here would be an
    // unhandled error with no owner.
    const store = {
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      }
    } as unknown as Storage;

    const outcome = saveProject(store, 'k', { schemaVersion: 3 });

    expect(outcome.kind).toBe<SaveOutcome['kind']>('unavailable');
  });
});

describe('describeSaveOutcome', () => {
  it('says nothing alarming about a normal save', () => {
    const outcome: SaveOutcome = { kind: 'saved', payloadBytes: 1024 };

    expect(describeSaveOutcome(outcome)).toBeNull();
  });

  it('tells the user their work is not being saved, not merely that it failed', () => {
    const outcome: SaveOutcome = {
      kind: 'quota-exceeded',
      payloadBytes: 6_000_000,
      budgetBytes: 5_225_472,
      overshootBytes: 774_528
    };

    const mensagem = describeSaveOutcome(outcome);

    // The point of the message: the user must know the autosave stopped, and
    // what to do about it. "Storage error" — or anything that does not say the
    // saving stopped — would leave them editing in false confidence. Asserting
    // the exact clause matters: an earlier version of this test matched `/save/i`,
    // which any sentence containing the word passes, and a mutation that gutted
    // the sentence went unnoticed.
    expect(mensagem).toMatch(/not being saved/i);
    expect(mensagem).toMatch(/too large/i);
    expect(mensagem).toMatch(/download|export/i);
  });

  it('does not claim the work is lost when the previous save survived', () => {
    const outcome: SaveOutcome = {
      kind: 'quota-exceeded',
      payloadBytes: 6_000_000,
      budgetBytes: 5_225_472,
      overshootBytes: 774_528
    };

    const mensagem = describeSaveOutcome(outcome);

    expect(mensagem).not.toMatch(/lost|deleted|discarded/i);
  });

  it('is quiet for a store that is simply unavailable', () => {
    // Private browsing is a normal mode, not a problem to announce every write.
    expect(describeSaveOutcome({ kind: 'unavailable' })).toBeNull();
  });
});
