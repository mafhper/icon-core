/**
 * A minimal IndexedDB test double.
 *
 * **What this is for, and what it is not.** The store under test uses six
 * operations: `open`, `createObjectStore`, `createIndex`, `get`, `getAll`, `put`,
 * `delete`, `getKey`. This implements those and nothing else, so the unit suite can
 * run in jsdom at full speed.
 *
 * **It is not a structured-clone implementation, and that is a known gap.** It
 * stores values by reference, so it cannot catch a record that IndexedDB would
 * reject to clone — a `FileSystemFileHandle` with a live permission, for instance.
 * Pretending otherwise is how a stub ends up lying, so the gap is closed from the
 * other side: `tests/e2e/project-store.spec.ts` exercises the same paths in real
 * Chromium, where cloning is real. If the two disagree, the browser wins.
 */

/**
 * The surface `settle` and `fail` need. Kept structural rather than referencing
 * `FakeRequest`, which is declared below: the class is what the tests cast the
 * results to, and having it depend on its own helpers would invert that.
 */
type Handler = {
  error: Error | null;
  onsuccess?: (() => void) | null;
  onerror?: (() => void) | null;
};

/** Resolve asynchronously, the way a real request would. */
const settle = (request: Handler, apply: () => void): void => {
  queueMicrotask(() => {
    apply();
    request.onsuccess?.();
  });
};

const fail = (request: Handler, error: Error): void => {
  queueMicrotask(() => {
    request.error = error;
    request.onerror?.();
  });
};

class FakeRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class FakeObjectStore {
  constructor(
    private readonly db: FakeDatabase,
    readonly name: string,
    private readonly mode: IDBTransactionMode
  ) {}

  private readonly write = (): boolean => this.mode === 'readwrite';

  createIndex(): { name: string } {
    return { name: 'updatedAt' };
  }

  get(key: string) {
    const request = new FakeRequest<unknown>();
    const value = this.db.data.get(key);
    settle(request, () => {
      request.result = value ? clone(value) : undefined;
    });
    return request as unknown as IDBRequest<unknown>;
  }

  getKey(key: string) {
    const request = new FakeRequest<unknown>();
    const has = this.db.data.has(key);
    settle(request, () => {
      request.result = has ? key : undefined;
    });
    return request as unknown as IDBRequest<unknown>;
  }

  getAll() {
    const request = new FakeRequest<unknown[]>();
    settle(request, () => {
      request.result = [...this.db.data.values()].map(clone);
    });
    return request as unknown as IDBRequest<unknown[]>;
  }

  put(value: Record<string, unknown>) {
    const request = new FakeRequest<unknown>();

    if (!this.write()) {
      fail(request, namedError('read-only transaction'));
      return request as unknown as IDBRequest<unknown>;
    }

    // A declared write failure is consulted here rather than by wrapping `put`:
    // a wrapper schedules `onsuccess` first and the injected `onerror` second, so
    // the request would resolve before it failed. Two microtasks racing is exactly
    // the kind of lie a double should not tell.
    if (this.db.failPutWith) {
      fail(request, namedError(this.db.failPutWith));
      return request as unknown as IDBRequest<unknown>;
    }

    this.db.data.set(String(value.id), value);
    settle(request, () => {
      request.result = value.id;
    });
    return request as unknown as IDBRequest<unknown>;
  }

  delete(key: string) {
    const request = new FakeRequest<undefined>();
    if (!this.write()) {
      fail(request, namedError('read-only transaction'));
      return request as unknown as IDBRequest<undefined>;
    }
    this.db.data.delete(key);
    settle(request, () => {
      request.result = undefined;
    });
    return request as unknown as IDBRequest<undefined>;
  }
}

const namedError = (name: string): Error => {
  const error = new Error(name);
  error.name = name;
  return error;
};

/**
 * Shallow copy: enough to stop a test mutating the store's own record.
 *
 * Typed through `object` rather than spreading `T`, because spreading a generic
 * produces `{}` and TypeScript is right to refuse the assignment back to `T` — the
 * copy really is only as good as the shallow one it is.
 */
const clone = <T>(value: T): T =>
  value && typeof value === 'object' ? ({ ...value } as T) : value;

export class FakeDatabase {
  readonly data = new Map<string, Record<string, unknown>>();
  // Only `contains` is ever called. Casting through `unknown` is honest here: a real
  // `DOMStringList` carries `length` and an indexer, which nothing in this store
  // needs, and faking them would be asserting behaviour nobody depends on.
  readonly objectStoreNames = { contains: (name: string): boolean => name === 'projects' } as unknown as DOMStringList;
  /** Set by the factory so `put` can refuse the way a full store would. */
  failPutWith: string | null = null;
  closed = false;

  transaction(_name: string, mode: IDBTransactionMode) {
    return { objectStore: (name: string) => new FakeObjectStore(this, name, mode) } as unknown as IDBTransaction;
  }

  createObjectStore() {
    return new FakeObjectStore(this, 'projects', 'versionchange');
  }

  close() {
    this.closed = true;
  }
}

export interface FakeFactoryOptions {
  /** Make `open` never call back — the "blocked" case. */
  block?: boolean;
  /** Make `open` throw synchronously — the "partitioned" case. */
  throwOnOpen?: boolean;
  /** Make `put` fail with this error name. */
  failPutWith?: string;
}

export class FakeIDBFactory {
  readonly db = new FakeDatabase();
  private readonly options: FakeFactoryOptions;

  constructor(options: FakeFactoryOptions = {}) {
    this.options = options;
    this.db.failPutWith = options.failPutWith ?? null;
  }

  open(): IDBOpenDBRequest {
    const request = new FakeRequest<IDBDatabase>() as FakeRequest<IDBDatabase> & {
      onupgradeneeded: (() => void) | null;
      onblocked: (() => void) | null;
      result: IDBDatabase;
    };
    request.onupgradeneeded = null;
    request.onblocked = null;

    if (this.options.throwOnOpen) throw new Error('storage is partitioned');

    if (this.options.block) {
      queueMicrotask(() => request.onblocked?.());
      return request as unknown as IDBOpenDBRequest;
    }

    queueMicrotask(() => {
      request.result = this.db as unknown as IDBDatabase;
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });

    return request as unknown as IDBOpenDBRequest;
  }

  deleteDatabase(): IDBOpenDBRequest {
    return this.open();
  }
}
