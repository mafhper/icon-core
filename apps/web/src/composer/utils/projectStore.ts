/**
 * Where the project lives: IndexedDB by default, `localStorage` when that is not
 * available, and never nothing.
 *
 * **Why this exists.** The autosave had a single `localStorage` slot, and its
 * budget is **5.101 KB** measured in Chromium — a project of imported logos hits
 * `QuotaExceededError` around layer 31. `D1` of the `IC63` moves the durable copy
 * to IndexedDB, whose ceiling is a different order of magnitude, and keeps File
 * System Access as an opt-in upgrade for "save in place".
 *
 * **The shape of the change that matters.** `localStorage` is synchronous and
 * IndexedDB is not, so restoring a project stops being something the provider can
 * do while rendering. That is why `openProjectStore` is async and why the caller
 * has to be able to render before it resolves — see `ComposerContext`.
 *
 * **Two design decisions that are not obvious:**
 *
 * 1. **The pointer stays in `localStorage`.** Which project is open is a UUID and
 *    a name — small enough for the ~5 MB budget and readable *synchronously*, so
 *    the UI can answer "is there something to continue?" before the body arrives.
 *    Putting it in IndexedDB would force every first paint to wait.
 * 2. **A fallback store, not a failure.** If IndexedDB is blocked — private
 *    browsing, a partitioned profile, a locked-down WebView — the app must keep
 *    working exactly as it did. `openProjectStore` returns the `localStorage`
 *    store in that case, so `D1` can only improve things and never regress them.
 */

import type { IconCoreProject } from '@iconcore/shared';
import { parseProjectFile } from './projectGuard';
import { saveProject, type SaveOutcome } from './projectStorage';

/** Durable copy. Versioned so a future shape change has somewhere to go. */
export const DB_NAME = 'iconcore-projects';
export const DB_VERSION = 1;
export const STORE_PROJECTS = 'projects';

/**
 * The synchronous pointer to the open project, in `localStorage`.
 *
 * Deliberately not in IndexedDB: `ComposerContext` needs to know *whether* a
 * project exists during the first render, and it needs to know its name to offer
 * "Continue <name>" before the body has loaded.
 */
export const POINTER_KEY = 'iconcore-current-project';

/** The legacy single slot. Read once, migrated, then left alone. */
export const LEGACY_SLOT_KEY = 'iconcore-composer-project';

export interface ProjectPointer {
  id: string;
  name: string;
  updatedAt: number;
}

export interface StoredProject extends ProjectPointer {
  project: IconCoreProject;
  /**
   * Present when the user asked to save in place. Opaque here on purpose: this
   * module is exercised in Node, where the type exists but the object does not,
   * and asserting on a handle's identity is not what these tests are for.
   */
  handle?: FileSystemFileHandle;
}

export interface ProjectStore {
  readonly kind: 'indexeddb' | 'localstorage';
  read(id: string): Promise<StoredProject | null>;
  /** `updatedAt` defaults to now; pass one explicitly to keep a record stable. */
  write(record: Omit<StoredProject, 'updatedAt'> & { updatedAt?: number }): Promise<SaveOutcome>;
  /**
   * Anexa (ou troca) a ligacao com o arquivo em disco, **sem** reescrever o
   * documento.
   *
   * Existe separado do `write` porque o handle e um **objeto de plataforma** e a
   * permissao e uma questao separada do conteudo: um `Save` bem-sucedido muda o
   * arquivo e nao muda o documento, e um `Save as` muda os dois. Juntar isso no
   * `write` faria cada autosave andar com um handle que ele nao usa.
   */
  setHandle(id: string, handle: FileSystemFileHandle | null): Promise<boolean>;
  /** Newest first. The `D2` welcome renders exactly this. */
  list(): Promise<ProjectPointer[]>;
  /** Whether a record was there to remove. */
  remove(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------

/**
 * `getItem` that cannot throw.
 *
 * A throwing `getItem` is rare but real — a sandboxed frame, some privacy modes,
 * a storage the browser has already invalidated. Every read goes through here,
 * because the provider must not die during startup for a storage it can simply
 * treat as empty.
 */
const safeGet = (storage: Pick<Storage, 'getItem'>, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Read the pointer, tolerating a corrupt value.
 *
 * A pointer is written on every autosave, so a partial write is not a theoretical
 * case — and a throw here would take down the provider on startup, which is the
 * worst place for a throw. Losing the pointer costs the user their "continue",
 * which `list()` can rebuild; refusing to start costs them the editor.
 */
export const readPointer = (storage: Pick<Storage, 'getItem'>): ProjectPointer | null => {
  const raw = safeGet(storage, POINTER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectPointer>;
    if (typeof parsed?.id !== 'string' || !parsed.id) return null;
    return {
      id: parsed.id,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Untitled',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    };
  } catch {
    return null;
  }
};

export const writePointer = (storage: Pick<Storage, 'setItem'>, pointer: ProjectPointer | null): void => {
  try {
    if (pointer === null) storage.setItem(POINTER_KEY, '');
    else storage.setItem(POINTER_KEY, JSON.stringify(pointer));
  } catch {
    // A full or blocked `localStorage` must not break saving. The project itself
    // is in IndexedDB by this point; only the shortcut is lost.
  }
};

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

/** Promise wrapper over a request, kept local so the module has no imports to drift. */
const fromRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolvePromise, rejectPromise) => {
    request.onsuccess = () => resolvePromise(request.result);
    request.onerror = () => rejectPromise(request.error ?? new Error('IndexedDB request failed'));
  });

/**
 * Open (and if needed create) the database.
 *
 * Returns `null` rather than throwing when IndexedDB cannot be opened at all. The
 * caller falls back, and a fallback that is reached by an exception is a fallback
 * that fails on the *first* call instead of every one.
 */
export const openDatabase = (factory: IDBFactory): Promise<IDBDatabase | null> =>
  new Promise((resolvePromise) => {
    let settled = false;
    const finish = (value: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolvePromise(value);
    };

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch {
      // Some engines throw synchronously when storage is partitioned.
      finish(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        // Keyed by id; `updatedAt` is indexed because `list()` sorts by it and
        // sorting in memory would load every project body to show a menu.
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => finish(request.result);
    request.onerror = () => finish(null);
    request.onblocked = () => finish(null);
  });

const storeFor = (db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore =>
  db.transaction(STORE_PROJECTS, mode).objectStore(STORE_PROJECTS);

const idbStore = (db: IDBDatabase, now: () => number): ProjectStore => ({
  kind: 'indexeddb',

  async read(id) {
    const record = (await fromRequest(storeFor(db, 'readonly').get(id))) as StoredProject | undefined;
    if (!record) return null;
    // A record can be present but unreadable — a schema we no longer accept, or a
    // handle that lost its permission. Callers want a project or nothing.
    const project = parseProjectFile(JSON.stringify(record.project));
    if (!project) return null;
    return { ...record, project };
  },

  async write(record) {
    const payload: StoredProject = {
      ...record,
      updatedAt: record.updatedAt ?? now()
    };
    try {
      await fromRequest(storeFor(db, 'readwrite').put(payload));
      return { kind: 'saved', payloadBytes: JSON.stringify(payload.project).length };
    } catch (error) {
      // The same contract as the `localStorage` path: a value, never a throw, so
      // the caller can tell the user something specific and say it once.
      const nome = (error as { name?: string } | null)?.name;
      if (nome === 'QuotaExceededError' || nome === 'NS_ERROR_DOM_QUOTA_REACHED') {
        return {
          kind: 'quota-exceeded',
          payloadBytes: JSON.stringify(payload.project).length,
          budgetBytes: 0,
          overshootBytes: 0
        };
      }
      return { kind: 'unavailable' };
    }
  },

  async list() {
    const all = (await fromRequest(storeFor(db, 'readonly').getAll())) as StoredProject[];
    return all
      .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async remove(id) {
    // `getKey` first so the answer is whether anything was there: `D2` wants to
    // tell "removed" from "was not there", and a delete on a missing key is silent.
    const key = await fromRequest(storeFor(db, 'readonly').getKey(id));
    if (key === undefined) return false;
    await fromRequest(storeFor(db, 'readwrite').delete(id));
    return true;
  },

  async setHandle(id, handle) {
    /**
     * Read-modify-write, e nao um `put` do handle.
     *
     * O registro tem **duas** metades que nao podem perder: o `project` e o `handle`.
     * Um `put({ id, handle })` resolveria o problema apagando o documento — e a
     * medida aqui e justamente que ele nao se perde. Por isso o `get` primeiro, e o
     * `handle` e substituido no registro existente.
     */
    try {
      const atual = await fromRequest(storeFor(db, 'readonly').get(id));
      if (!atual) return false;
      await fromRequest(
        storeFor(db, 'readwrite').put(handle ? { ...atual, handle } : { ...atual, handle: undefined })
      );
      return true;
    } catch {
      // Um handle que o engine recusa clonar (e um engine onde `structuredClone` nao
      // trata objetos de plataforma) resolve para "a ligacao nao foi guardada". O
      // projeto continua no store: e a `Save` que vai pedir o picker de novo.
      return false;
    }
  }
});

// ---------------------------------------------------------------------------
// localStorage fallback
// ---------------------------------------------------------------------------

/**
 * `getItem` that cannot throw.
 *
 * A throwing `getItem` is rare but real — a sandboxed frame, some privacy modes,
 * a storage the browser has already invalidated. Every read of the legacy slot
 * goes through here, because the provider must not die during startup for a
 * storage it can simply treat as empty.
 */


/**
 * The pre-`D1` behaviour, kept whole.
 *
 * One slot, no list, no id — which is why `id` is derived from the slot itself and
 * why `remove` can only ever report success. This exists so that an engine without
 * IndexedDB loses nothing it had before, rather than losing everything at once.
 */
const localStorageStore = (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, id: string, now: () => number): ProjectStore => ({
  kind: 'localstorage',

  async read() {
    const raw = safeGet(storage, LEGACY_SLOT_KEY);
    if (!raw) return null;
    const project = parseProjectFile(raw);
    if (!project) return null;
    return {
      id,
      name: project.metadata.name,
      updatedAt: 0,
      project
    };
  },

  async write(record) {
    const outcome = saveProject(storage as Pick<Storage, 'setItem'>, LEGACY_SLOT_KEY, record.project);
    if (outcome.kind === 'saved') {
      storage.setItem(POINTER_KEY, JSON.stringify({ id: record.id, name: record.name, updatedAt: record.updatedAt ?? now() }));
    }
    return outcome;
  },

  async list() {
    const raw = safeGet(storage, LEGACY_SLOT_KEY);
    if (!raw) return [];
    const project = parseProjectFile(raw);
    if (!project) return [];
    return [{ id, name: project.metadata.name, updatedAt: 0 }];
  },

  async remove() {
    try {
      storage.removeItem(LEGACY_SLOT_KEY);
    } catch {
      // Nothing useful to do, and the caller's confirmation does not depend on it.
    }
    // Cannot be known, and the caller only uses it to word a confirmation.
    return true;
  },

  /**
   * Este store e o pre-`D1`: um so slot, e o handle nao cabe em `localStorage`.
   *
   * `false` nao e falha — e a resposta honesta. `setHandle` devolve `false` para dizer
   * "a ligacao nao foi guardada", e o `Save` trata isso do mesmo jeito que trata um
   * handle ausente: pede o picker outra vez. Um `true` aqui seria uma promessa que o
   * slot nao pode cumprir.
   */
  async setHandle() {
    return false;
  }
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface OpenStoreDeps {
  /** Absent in Node and in an engine without IndexedDB. */
  factory?: IDBFactory | null;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Injectable so a test can pin time instead of asserting on `Date.now()`. */
  now?: () => number;
  /** Injectable so a test gets a stable id. */
  newId?: () => string;
}

export interface OpenedStore {
  store: ProjectStore;
  pointer: ProjectPointer | null;
}

/**
 * Pick the best available store and report what is already there.
 *
 * The order is: IndexedDB, then the legacy slot, then nothing. Reading the legacy
 * slot is deliberate — this is the migration path for everyone who already has a
 * project saved, and doing it here means the caller never has to know it happened.
 *
 * `factory` is passed in rather than read from the global so this is testable and
 * so an engine that defines the global but cannot open a database is handled by
 * the same `null` path.
 */
export const openProjectStore = async (deps: OpenStoreDeps): Promise<OpenedStore> => {
  const { storage, factory } = deps;
  const now = deps.now ?? Date.now;

  const existingPointer = readPointer(storage);
  const db = factory ? await openDatabase(factory) : null;

  if (db) {
    const store = idbStore(db, now);
    const legacyStore = () => localStorageStore(storage, existingPointer?.id ?? 'local', now);

    if (existingPointer) {
      const found = await store.read(existingPointer.id);
      if (found) return { store, pointer: existingPointer };

      // The pointer survived but the record did not — a cleared database, or a
      // record from a shape we no longer read. The legacy slot is then the only
      // place the project can still be.
      const legacy = await legacyStore().read(existingPointer.id);
      if (!legacy) return { store, pointer: null };

      // **The store returned has to match where the project actually is.** An
      // earlier version returned the IndexedDB store here with a pointer naming
      // the legacy project — so `store.read(pointer.id)` came back null, and the
      // user got an empty editor over work that was sitting in `localStorage`.
      // Two of the tests below exist only to hold that closed.
      const repaired = await store.write({
        id: legacy.id,
        name: legacy.name,
        project: legacy.project
      });
      if (repaired.kind === 'saved') {
        const pointer = { id: legacy.id, name: legacy.name, updatedAt: now() };
        writePointer(storage, pointer);
        return { store, pointer };
      }
      // Could not repair into IndexedDB. Stay on the store that has the data.
      return { store: legacyStore(), pointer: { id: legacy.id, name: legacy.name, updatedAt: now() } };
    }

    // No pointer: is this a first run after the upgrade? The legacy slot is the
    // only place an existing project can be.
    const legacyRaw = safeGet(storage, LEGACY_SLOT_KEY);
    if (legacyRaw) {
      const project = parseProjectFile(legacyRaw);
      if (project) {
        const id = (deps.newId ?? defaultId)();
        const record: StoredProject = { id, name: project.metadata.name, updatedAt: now(), project };
        const outcome = await store.write(record);
        if (outcome.kind === 'saved') {
          const pointer = { id, name: record.name, updatedAt: record.updatedAt };
          writePointer(storage, pointer);
          return { store, pointer };
        }
        // The migration itself failed — most likely a quota. The legacy slot is
        // still there and untouched, so serve it from the store that has it
        // rather than opening an empty editor over demonstrably readable work.
        return {
          store: localStorageStore(storage, id, now),
          pointer: { id, name: record.name, updatedAt: record.updatedAt }
        };
      }
    }

    return { store, pointer: null };
  }

  // No IndexedDB. Behave exactly as before `D1`.
  const id = existingPointer?.id ?? 'local';
  const legacy = await localStorageStore(storage, id, now).read(id);
  return {
    store: localStorageStore(storage, id, now),
    pointer: legacy ? { id, name: legacy.name, updatedAt: 0 } : null
  };
};

/**
 * The id for a project being migrated in.
 *
 * Prefixed `p-`, like the id the reducer mints for a replacement project. The two
 * minting sites were written a week apart and disagreed: this one returned a bare
 * UUID while `mintProjectId` returns `p-<uuid>`. Both are valid IndexedDB keys, so
 * nothing broke and nothing complained — but an id that appears in two formats
 * depending on how the project came to be is the kind of thing that makes a later
 * reader assume there are two kinds of id.
 */
const defaultId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `p-${c.randomUUID()}`;
  // A random id only has to be unique within one browser profile.
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export { defaultId as newProjectId };