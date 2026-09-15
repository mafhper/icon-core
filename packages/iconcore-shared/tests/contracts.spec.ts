import { describe, expect, it, vi } from 'vitest';
import {
  InteractionTransaction,
  PERSISTENT_FIELDS,
  TRANSIENT_FIELDS,
  UI_FIELDS,
  stateSection,
  type HistoryableOperation,
  type PathData
} from '../src/index';

describe('state boundaries (contract 6.1)', () => {
  it('declares every field under exactly one section', () => {
    const all = [
      ...PERSISTENT_FIELDS,
      ...TRANSIENT_FIELDS,
      ...UI_FIELDS
    ] as string[];

    expect(new Set(all).size).toBe(all.length);
  });

  it('resolves each declared field to its section', () => {
    for (const field of PERSISTENT_FIELDS) expect(stateSection(field)).toBe('persistent');
    for (const field of TRANSIENT_FIELDS) expect(stateSection(field)).toBe('transient');
    for (const field of UI_FIELDS) expect(stateSection(field)).toBe('ui');
  });

  it('returns null for unknown fields', () => {
    expect(stateSection('not-a-field')).toBeNull();
  });
});

describe('InteractionTransaction (contract 6.2)', () => {
  type Input = { x: number };
  type Preview = { x: number };
  type Commit = HistoryableOperation;

  const makeTransaction = () => {
    const onCommit = vi.fn((_input: Input): Commit => ({ kind: 'MoveLayer' }));
    const transaction = new InteractionTransaction<Input, Preview, Commit>({ onCommit });
    return { transaction, onCommit };
  };

  it('begin activates the transaction and calls onBegin once', () => {
    const onBegin = vi.fn();
    const transaction = new InteractionTransaction<Input, Preview, Commit>({ onBegin, onCommit: vi.fn() });

    transaction.begin({ x: 0 });
    transaction.begin({ x: 5 });

    expect(transaction.isActive).toBe(true);
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onBegin).toHaveBeenCalledWith({ x: 0 });
  });

  it('preview never commits and reports the transformed value', () => {
    const { onCommit } = makeTransaction();
    const onPreview = vi.fn();
    const withPreview = new InteractionTransaction<Input, Preview, Commit>({
      onPreview,
      onCommit: vi.fn()
    });

    withPreview.begin({ x: 1 });
    withPreview.preview((input) => ({ x: input.x + 1 }));

    expect(onPreview).toHaveBeenCalledWith({ x: 1 }, { x: 2 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commit emits exactly one semantic operation per gesture', () => {
    const { transaction, onCommit } = makeTransaction();

    transaction.begin({ x: 0 });
    transaction.preview((input) => ({ x: input.x + 1 }));
    transaction.preview((input) => ({ x: input.x + 2 }));
    const result = transaction.commit();
    const second = transaction.commit();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ x: 0 });
    expect(result).toEqual({ kind: 'MoveLayer' });
    expect(second).toBeNull();
  });

  it('preview and commit are no-ops while inactive', () => {
    const { transaction, onCommit } = makeTransaction();

    transaction.preview((input) => input);
    const result = transaction.commit();

    expect(result).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('cancel discards the gesture', () => {
    const { transaction, onCommit } = makeTransaction();

    transaction.begin({ x: 4 });
    transaction.cancel();
    const result = transaction.commit();

    expect(transaction.isActive).toBe(false);
    expect(result).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a new gesture starts after commit', () => {
    const { transaction, onCommit } = makeTransaction();

    transaction.begin({ x: 1 });
    transaction.commit();
    transaction.begin({ x: 2 });
    transaction.commit();

    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('path data types stay structural (compile-time contract 6.3)', () => {
    const path: PathData = [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 10 },
      { type: 'Q', x1: 0, y1: 10, x: 5, y: 5 },
      { type: 'C', x1: 0, y1: 0, x2: 10, y2: 0, x: 10, y: 10 },
      { type: 'Z' }
    ];

    // Geometric contract: M + L + Q + C + Z serialize to d in the same order.
    const d = path
      .map((command) => {
        switch (command.type) {
          case 'M': return `M ${command.x} ${command.y}`;
          case 'L': return `L ${command.x} ${command.y}`;
          case 'Q': return `Q ${command.x1} ${command.y1} ${command.x} ${command.y}`;
          case 'C': return `C ${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`;
          case 'Z': return 'Z';
        }
      })
      .join(' ');

    expect(d).toBe('M 0 0 L 10 10 Q 0 10 5 5 C 0 0 10 0 10 10 Z');
  });
});