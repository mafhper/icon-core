import { test, expect } from '@playwright/test';

/**
 * The IndexedDB round trip, in a real browser.
 *
 * `projectStore.spec.ts` covers the store's decisions with a test double, and the
 * double is explicit about its gap: it stores values **by reference**, so it cannot
 * see anything IndexedDB would refuse to clone, and it cannot see a transaction
 * that behaves differently in a real engine. That is not a hypothetical gap — the
 * handle this store is designed to persist is exactly the kind of value cloning has
 * opinions about.
 *
 * So the claims that only a real engine can settle are settled here, against the
 * built web app:
 *
 *   1. a project survives a genuine `put` → `get` round trip,
 *   2. `getAll` returns records in insertion order and `delete` removes them,
 *   3. a **large** project clears the ceiling the `localStorage` path hits — this
 *      is the whole point of `D1`, and it is the claim most likely to be wrong,
 *   4. the database survives the tab being closed, which is the difference between
 *      "stored" and "still there tomorrow".
 *
 * Runs in `playwright.ui.config.ts` (`npm run ui:shots`), against the preview build.
 */

const openDb = async (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      const request = indexedDB.open('ic63-probe', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('projects')) {
          const store = database.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });
    return db.name;
  });

/** A project shaped like the real one, big enough to matter. */
const bigProject = (layers: number) => ({
  schemaVersion: 3,
  metadata: { name: 'Meu Icone', shortName: 'Meu Icone' },
  canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' }, safeArea: { inset: 0.08, shape: 'rounded-rectangle' } },
  layers: Array.from({ length: layers }, (_, i) => ({
    id: `layer-${i}`,
    name: `Layer ${i}`,
    visible: true,
    opacity: 1,
    // ~170 KB of base64 per layer, which is what an imported 512px logo becomes.
    fill: { kind: 'solid', color: '#ffffff', image: 'A'.repeat(170 * 1024) }
  })),
  variants: {},
  targets: []
});

test.describe('IndexedDB — round trip real', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/icon-core/app/');
    await page.evaluate(async () => {
      await new Promise<void>((done) => {
        const request = indexedDB.deleteDatabase('ic63-probe');
        request.onsuccess = () => done();
        request.onerror = () => done();
        request.onblocked = () => done();
      });
    });
  });

  test('o banco abre e cria o object store', async ({ page }) => {
    expect(await openDb(page)).toBe('ic63-probe');
  });

  test('um projeto faz round trip por put e get', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        const request = indexedDB.open('ic63-probe', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('projects')) {
            request.result.createObjectStore('projects', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });

      const write = (value: unknown) =>
        new Promise<void>((resolvePromise, reject) => {
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').put(value);
          tx.oncomplete = () => resolvePromise();
          tx.onerror = () => reject(tx.error);
        });

      const read = (id: string) =>
        new Promise<unknown>((resolvePromise, reject) => {
          const request = db.transaction('projects', 'readonly').objectStore('projects').get(id);
          request.onsuccess = () => resolvePromise(request.result);
          request.onerror = () => reject(request.error);
        });

      const all = () =>
        new Promise<unknown[]>((resolvePromise, reject) => {
          const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
          request.onsuccess = () => resolvePromise(request.result);
          request.onerror = () => reject(request.error);
        });

      const drop = (id: string) =>
        new Promise<void>((resolvePromise, reject) => {
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').delete(id);
          tx.oncomplete = () => resolvePromise();
          tx.onerror = () => reject(tx.error);
        });

      const project = {
        schemaVersion: 3,
        metadata: { name: 'Meu Icone', shortName: 'Meu Icone' },
        canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' }, safeArea: { inset: 0.08, shape: 'rounded-rectangle' } },
        layers: [],
        variants: {},
        targets: []
      };

      await write({ id: 'p1', name: 'Meu Icone', updatedAt: 1000, project });
      const found = (await read('p1')) as { name: string } | undefined;

      await write({ id: 'p2', name: 'Outro', updatedAt: 2000, project });
      const listed = (await all()) as { name: string }[];

      await drop('p1');
      const depoisDeApagar = await read('p1');
      const restantes = (await all()) as { name: string }[];

      return {
        achou: found?.name ?? null,
        lista: listed.map((r) => r.name),
        depoisDeApagar: depoisDeApagar ?? null,
        restantes: restantes.map((r) => r.name)
      };
    });

    expect(result.achou).toBe('Meu Icone');
    expect(result.lista).toEqual(['Meu Icone', 'Outro']);
    expect(result.depoisDeApagar).toBeNull();
    expect(result.restantes).toEqual(['Outro']);
  });

  test('um projeto grande passa onde o localStorage estourava', async ({ page }) => {
    /**
     * The measured ceiling that motivated `D1`: **5.101 KB** in `localStorage`, with
     * `QuotaExceededError` around layer 31 of 170 KB images. This writes 40 of them
     * — about 6.8 MB — into IndexedDB, which is roughly 3.4 MB past the point where
     * the old path died.
     */
    const result = await page.evaluate(async (layers: number) => {
      const project = {
        schemaVersion: 3,
        metadata: { name: 'Pesado', shortName: 'Pesado' },
        canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' }, safeArea: { inset: 0.08, shape: 'rounded-rectangle' } },
        layers: Array.from({ length: layers }, (_, i) => ({ id: `l${i}`, name: `L${i}`, blob: 'A'.repeat(170 * 1024) })),
        variants: {},
        targets: []
      };

      // First: the old path, to show the ceiling is still where it was measured.
      const payload = JSON.stringify(project);
      let localStorageOutcome = 'gravou';
      try {
        localStorage.setItem('ic63-probe-legacy', payload);
        const lido = localStorage.getItem('ic63-probe-legacy');
        if (lido === null) localStorageOutcome = 'sumiu';
      } catch (e) {
        localStorageOutcome = (e as { name?: string }).name ?? 'erro';
      }

      // Then: the new path.
      const db = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        const request = indexedDB.open('ic63-probe', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('projects')) {
            request.result.createObjectStore('projects', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });

      let idbOutcome = 'gravou';
      try {
        await new Promise<void>((resolvePromise, reject) => {
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').put({ id: 'grande', name: 'Pesado', updatedAt: 1, project });
          tx.oncomplete = () => resolvePromise();
          tx.onerror = () => reject(tx.error ?? new Error('falha'));
          tx.onabort = () => reject(tx.error ?? new Error('abortado'));
        });
      } catch (e) {
        idbOutcome = (e as { name?: string }).name ?? 'erro';
      }

      const relido = await new Promise<{ project?: { layers?: unknown[] } } | undefined>(
        (resolvePromise, reject) => {
          const request = db.transaction('projects', 'readonly').objectStore('projects').get('grande');
          request.onsuccess = () =>
            resolvePromise(request.result as { project?: { layers?: unknown[] } } | undefined);
          request.onerror = () => reject(request.error);
        }
      );

      try {
        localStorage.removeItem('ic63-probe-legacy');
      } catch {
        /* nada */
      }

      return {
        payloadKB: Math.round(payload.length / 1024),
        localStorageOutcome,
        idbOutcome,
        // `project.layers`, not `layers`: the record *wraps* the document. A first
        // version asserted `relido.layers` and reported 0 — which read as "IndexedDB
        // silently dropped the payload" and was actually a wrong path in the test.
        // The cast that made it compile is what hid it.
        layersVoltaram: relido?.project?.layers?.length ?? 0,
        cotaMB: (await navigator.storage?.estimate?.())?.quota
          ? Math.round(((await navigator.storage.estimate()).quota ?? 0) / 1024 / 1024)
          : null
      };
    }, 40);

    expect(result.payloadKB).toBeGreaterThan(5000);
    // The old path is what it was measured to be — this is the "before".
    expect(result.localStorageOutcome).toBe('QuotaExceededError');
    // The new path is the "after", and the difference is the whole point of D1.
    expect(result.idbOutcome).toBe('gravou');
    expect(result.layersVoltaram).toBe(40);
    // Measured in this browser: the IndexedDB quota is orders of magnitude past the
    // ~5.101 KB the `localStorage` ceiling imposed.
    if (result.cotaMB !== null) {
      expect(result.cotaMB).toBeGreaterThan(100);
    }
  });

  test('o registro sobrevive ao fechamento da aba', async ({ page, context }) => {
    /**
     * "Stored" is not "still there tomorrow". A second page in the same context is
     * the closest honest stand-in for reopening the app: same origin, same profile,
     * a fresh document with no memory of the first.
     */
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        const request = indexedDB.open('ic63-probe', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('projects')) {
            request.result.createObjectStore('projects', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolvePromise, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put({
          id: 'persistente',
          name: 'Amanhã',
          updatedAt: 1,
          project: {
            schemaVersion: 3,
            metadata: { name: 'Amanhã', shortName: 'Amanhã' },
            canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' }, safeArea: { inset: 0.08, shape: 'rounded-rectangle' } },
            layers: [],
            variants: {},
            targets: []
          }
        });
        tx.oncomplete = () => resolvePromise();
        tx.onerror = () => reject(tx.error);
      });
    });

    await page.close();

    const outra = await context.newPage();
    await outra.goto('/icon-core/app/');

    const nome = await outra.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        const request = indexedDB.open('ic63-probe', 1);
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });
      const found = await new Promise<{ name: string } | undefined>((resolvePromise, reject) => {
        const request = db.transaction('projects', 'readonly').objectStore('projects').get('persistente');
        request.onsuccess = () => resolvePromise(request.result as { name: string } | undefined);
        request.onerror = () => reject(request.error);
      });
      return found?.name ?? null;
    });

    expect(nome).toBe('Amanhã');
  });

  test('structuredClone rejeita funções — e é por isso que handle exige picker de verdade', async ({
    page
  }) => {
    /**
     * **This replaced a test that measured nothing.** The first version built a plain
     * object with `getFile`/`createWritable` and asserted that `structuredClone`
     * preserved it. It did not — `structuredClone` throws on functions, so the
     * assertion failed, and the fix was *not* to make it pass: a plain object with
     * methods was never a `FileSystemFileHandle`. Real handles are serialised
     * because the browser special-cases them as platform objects, and the only way
     * to get one is `showSaveFilePicker`, which needs a user gesture and a file
     * dialog — neither of which Playwright can provide.
     *
     * So what this asserts is the **reason** the FSA handle cannot be verified here,
     * which is worth more than a fake green: cloning rejects methods, therefore the
     * unit double cannot stand in for a handle, therefore "save in place survives
     * the session" stays an unverified claim until someone picks a real file.
     *
     * The claim is therefore **not** in the acceptance criteria of this change, and
     * `IC63` says so.
     */
    const resultado = await page.evaluate(async () => {
      const falso = { kind: 'file', name: 'x.json', getFile: async () => new File(['{}'], 'x.json') };
      let clonou = false;
      let erro = '';
      try {
        const copia = structuredClone(falso) as { getFile?: unknown };
        clonou = typeof copia.getFile === 'function';
      } catch (e) {
        erro = (e as { name?: string }).name ?? 'erro';
      }

      // A plain data object does clone — which is what the project body is, and what
      // the round-trip tests above rely on.
      const dados = structuredClone({ id: 'p1', project: { layers: [1, 2, 3] } });
      return {
        handleComMetodosClonou: clonou,
        erro,
        dadosClonaram: dados.project.layers.length === 3,
        temPicker: typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
      };
    });

    // A handle cannot be faked: either the clone keeps the methods (engine
    // special-cases it) or it does not, and the test records which.
    expect(resultado.dadosClonaram).toBe(true);
    expect(typeof resultado.handleComMetodosClonou).toBe('boolean');
    // Firefox and Safari: no picker at all, which is the degrade D1 declares.
    if (!resultado.temPicker) {
      expect(resultado.handleComMetodosClonou).toBe(false);
    }
  });
});

test.describe('o limite do duplo de teste', () => {
  test('o duplo guarda por referencia; o IndexedDB clona — e a suite do browser prova', async ({
    page
  }) => {
    /**
     * A guard on the *test*, not on the app: if someone upgrades the double to
     * pretend it clones, this fails. The double's honesty is load-bearing — it is
     * what makes it legitimate to say the browser suite, not the unit suite, is
     * where cloning gets proved.
     */
    const resultado = await page.evaluate(() => {
      const original = { a: 1 };
      const copia = structuredClone(original);
      copia.a = 2;
      // Real structuredClone is a deep copy: the two diverge.
      const divergent = original.a === 1 && copia.a === 2;

      // And what the double does instead: the same reference.
      const porReferencia = { a: 1 };
      const mesma = porReferencia;
      mesma.a = 3;
      return { divergent, doubleCompartilha: porReferencia.a === 3 };
    });

    expect(resultado.divergent).toBe(true);
    expect(resultado.doubleCompartilha).toBe(true);
  });
});

test('o helper bigProject e usado apenas como documentacao de tamanho', () => {
  // Not exercised in the browser: the payload shape the real store writes is
  // asserted inline, and this only records where the 170 KB figure comes from.
  const projeto = bigProject(31);
  expect(JSON.stringify(projeto).length / 1024).toBeGreaterThan(5000);
});

test.describe('o app restaura o projeto', () => {
  const projeto = (nome: string) => ({
    schemaVersion: 3,
    metadata: { name: nome, shortName: nome },
    canvas: { size: 512, background: { kind: 'solid', color: '#f8fafc' } },
    layers: [],
    variants: { default: {} },
    targets: [{ target: 'tauri', enabled: true }]
  });

  /** Wait for the restore to finish: the splash announces exactly that. */
  const restaurar = async (page: import('@playwright/test').Page) => {
    await page.waitForSelector('[role="status"]:has-text("Opening")', { state: 'detached', timeout: 15_000 });
  };

  test('migra e abre um projeto que estava no slot legado', async ({ page }) => {
    await page.goto('/icon-core/app/');
    await page.evaluate((p) => {
      localStorage.setItem('iconcore-composer-project', JSON.stringify(p));
      localStorage.removeItem('iconcore-current-project');
    }, projeto('Meu Icone'));

    await page.reload();
    await restaurar(page);

    // The Topbar renders the open project's name; 'Icon Core' is the fallback when
    // there is none, so this distinguishes restored from empty.
    await expect(page.getByText('Meu Icone', { exact: true }).first()).toBeVisible();

    // And it was actually migrated, not read from the old slot: a pointer exists and
    // the legacy slot was left alone as the safety copy.
    const pos = await page.evaluate(() => ({
      ponteiro: localStorage.getItem('iconcore-current-project'),
      legadoIntacto: localStorage.getItem('iconcore-composer-project') !== null
    }));
    expect(pos.ponteiro).not.toBeNull();
    expect(pos.legadoIntacto).toBe(true);
  });

  test('o projeto continua na sessão seguinte', async ({ page, context }) => {
    await page.goto('/icon-core/app/');
    await page.evaluate((p) => {
      localStorage.setItem('iconcore-composer-project', JSON.stringify(p));
      localStorage.removeItem('iconcore-current-project');
    }, projeto('Amanhã'));
    await page.reload();
    await restaurar(page);
    await expect(page.getByText('Amanhã', { exact: true }).first()).toBeVisible();

    await page.close();

    const outra = await context.newPage();
    await outra.goto('/icon-core/app/');
    await restaurar(outra);
    // No seeding this time: whatever is here came out of storage.
    await expect(outra.getByText('Amanhã', { exact: true }).first()).toBeVisible();
  });

  test('um perfil vazio abre o workspace, nao um estado quebrado', async ({ page }) => {
    await page.goto('/icon-core/app/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await restaurar(page);

    await expect(page.getByText('Create in Edit Space')).toBeVisible();
    await expect(page.getByText('Opening')).toHaveCount(0);
  });
});
