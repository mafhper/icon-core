import { describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../utils/projectFactory';
import {
  LEGACY_SLOT_KEY,
  POINTER_KEY,
  openProjectStore,
  readPointer,
  writePointer,
  type ProjectPointer
} from '../utils/projectStore';
import { FakeIDBFactory } from '../../test/fakeIndexedDb';

/**
 * A `localStorage`-shaped object with room to make it misbehave.
 *
 * `Pick<Storage, …>` is satisfied by a plain object, so the store under test does
 * not care which one it got — and neither should the tests.
 */
const makeStorage = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    raw: map
  };
};

/** Whether a key survived — reads through `safeGet` so it cannot throw. */
const localStorageHas = (storage: ReturnType<typeof makeStorage>, key: string): boolean => {
  try {
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
};

const pointer = (over: Partial<ProjectPointer> = {}): ProjectPointer => ({
  id: 'p1',
  name: 'Meu Icone',
  updatedAt: 1000,
  ...over
});

const deps = (storage: ReturnType<typeof makeStorage>, factory: FakeIDBFactory | null, over = {}) => ({
  storage,
  factory: factory as unknown as IDBFactory | null,
  now: () => 5000,
  newId: () => 'gerado-1',
  ...over
});

describe('projectStore — ponteiro', () => {
  it('devolve null quando nao ha ponteiro', () => {
    expect(readPointer(makeStorage())).toBeNull();
  });

  it('lê o ponteiro gravado', () => {
    const s = makeStorage({ [POINTER_KEY]: JSON.stringify(pointer()) });
    expect(readPointer(s)).toEqual(pointer());
  });

  it('sobrevive a um ponteiro corrompido em vez de derrubar o boot', () => {
    // O ponteiro é escrito a cada autosave, então escrita parcial não é teórica —
    // e um throw aquiacontece no lugar pior possível: o startup do provider.
    expect(readPointer(makeStorage({ [POINTER_KEY]: '{ nao é json' }))).toBeNull();
  });

  it('devolve null para um ponteiro sem id', () => {
    expect(readPointer(makeStorage({ [POINTER_KEY]: JSON.stringify({ name: 'x' }) }))).toBeNull();
  });

  it('preenche nome e updatedAt ausentes em vez de devolver undefined', () => {
    const s = makeStorage({ [POINTER_KEY]: JSON.stringify({ id: 'p1' }) });
    expect(readPointer(s)).toEqual({ id: 'p1', name: 'Untitled', updatedAt: 0 });
  });

  it('grava e apaga o ponteiro', () => {
    const s = makeStorage();
    writePointer(s, pointer());
    expect(readPointer(s)).toEqual(pointer());
    writePointer(s, null);
    expect(readPointer(s)).toBeNull();
  });

  it('nao lanca quando o storage recusa a escrita', () => {
    const s = {
      ...makeStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      }
    };
    expect(() => writePointer(s, pointer())).not.toThrow();
  });
});

describe('projectStore — IndexedDB', () => {
  it('faz round trip: grava, le de volta, e devolve o projeto', async () => {
    const factory = new FakeIDBFactory();
    const { store } = await openProjectStore(deps(makeStorage(), factory));
    const project = createBlankProject('Meu Icone');

    const outcome = await store.write({ id: 'p1', name: 'Meu Icone', project });
    expect(outcome.kind).toBe('saved');

    const found = await store.read('p1');
    expect(found?.name).toBe('Meu Icone');
    expect(found?.project.metadata.name).toBe('Meu Icone');
  });

  it('devolve null para id inexistente', async () => {
    const { store } = await openProjectStore(deps(makeStorage(), new FakeIDBFactory()));
    expect(await store.read('nao-existe')).toBeNull();
  });

  it('devolve null quando o registro guarda um projeto ilegivel', async () => {
    // Um registro pode estar presente e ser ilegível — esquema que não aceitamos
    // mais. O chamador quer um projeto ou nada, nunca um meio-projeto.
    const factory = new FakeIDBFactory();
    const { store } = await openProjectStore(deps(makeStorage(), factory));
    await store.write({ id: 'p1', name: 'x', project: { schemaVersion: 99 } as never });
    expect(await store.read('p1')).toBeNull();
  });

  it('lista do mais recente para o mais antigo', async () => {
    const { store } = await openProjectStore(deps(makeStorage(), new FakeIDBFactory()));
    const project = createBlankProject('a');
    await store.write({ id: 'antigo', name: 'antigo', project, updatedAt: 100 });
    await store.write({ id: 'novo', name: 'novo', project, updatedAt: 900 });
    await store.write({ id: 'meio', name: 'meio', project, updatedAt: 500 });

    expect((await store.list()).map((p) => p.name)).toEqual(['novo', 'meio', 'antigo']);
  });

  it('remove distingue "estava lá" de "não estava"', async () => {
    // O D2 usa isso para redigir a confirmação; um delete em chave ausente é
    // silencioso, e o usuário precisa de "removido", não de silêncio.
    const { store } = await openProjectStore(deps(makeStorage(), new FakeIDBFactory()));
    expect(await store.remove('nao-existe')).toBe(false);

    await store.write({ id: 'p1', name: 'x', project: createBlankProject('x') });
    expect(await store.remove('p1')).toBe(true);
    expect(await store.read('p1')).toBeNull();
  });

  it('traduz estouro de cota em valor, nunca em excecao', async () => {
    const factory = new FakeIDBFactory({ failPutWith: 'QuotaExceededError' });
    const { store } = await openProjectStore(deps(makeStorage(), factory));
    const outcome = await store.write({ id: 'p1', name: 'x', project: createBlankProject('x') });
    expect(outcome.kind).toBe('quota-exceeded');
  });

  it('traduz qualquer outro erro de escrita em unavailable', async () => {
    const factory = new FakeIDBFactory({ failPutWith: 'UnknownError' });
    const { store } = await openProjectStore(deps(makeStorage(), factory));
    expect((await store.write({ id: 'p1', name: 'x', project: createBlankProject('x') })).kind).toBe('unavailable');
  });

  it('estabelece updatedAt quando o chamador nao passa', async () => {
    const factory = new FakeIDBFactory();
    const { store } = await openProjectStore(deps(makeStorage(), factory));
    await store.write({ id: 'p1', name: 'x', project: createBlankProject('x') });
    expect((await store.read('p1'))?.updatedAt).toBe(5000);
  });
});

describe('projectStore — migração do slot legado', () => {
  it('migra o projeto existente e escreve o ponteiro', async () => {
    const storage = makeStorage({
      [LEGACY_SLOT_KEY]: JSON.stringify(createBlankProject('Meu Icone'))
    });
    const factory = new FakeIDBFactory();

    const { store, pointer: p } = await openProjectStore(deps(storage, factory));

    expect(p).toEqual({ id: 'gerado-1', name: 'Meu Icone', updatedAt: 5000 });
    expect(readPointer(storage)).toEqual(p);
    expect((await store.read('gerado-1'))?.project.metadata.name).toBe('Meu Icone');
  });

  it('nao apaga o slot legado — a migracao e copia, nao movimento', async () => {
    // Se a escrita no IndexedDB passar, o slot legado some. Se falhar, ele é a
    // unica copia do trabalho, some. "Copy, don't move" e o comportamento
    // seguro; apagar aqui seria apostar que o destino gravou.
    const storage = makeStorage({
      [LEGACY_SLOT_KEY]: JSON.stringify(createBlankProject('Meu Icone'))
    });
    await openProjectStore(deps(storage, new FakeIDBFactory()));
    expect(storage.getItem(LEGACY_SLOT_KEY)).not.toBeNull();
  });

  it('cai para o slot legado quando a migracao estoura a cota, sem perder nada', async () => {
    const storage = makeStorage({
      [LEGACY_SLOT_KEY]: JSON.stringify(createBlankProject('Meu Icone'))
    });
    const factory = new FakeIDBFactory({ failPutWith: 'QuotaExceededError' });

    const { store, pointer: p } = await openProjectStore(deps(storage, factory));

    expect(store.kind).toBe('localstorage');
    expect(p?.name).toBe('Meu Icone');
    expect((await store.read('local'))?.project.metadata.name).toBe('Meu Icone');
  });

  it('ignora um slot legado corrompido em vez de quebrar o boot', async () => {
    const { store, pointer: p } = await openProjectStore(
      deps(makeStorage({ [LEGACY_SLOT_KEY]: 'lixo' }), new FakeIDBFactory())
    );
    expect(p).toBeNull();
    expect(store.kind).toBe('indexeddb');
  });
});

describe('projectStore — degrada sem IndexedDB', () => {
  it('usa o armazenamento local quando nao ha factory', async () => {
    const { store } = await openProjectStore(deps(makeStorage(), null));
    expect(store.kind).toBe('localstorage');
  });

  it('usa o armazenamento local quando open lanca de forma sincrona', async () => {
    // Engines particionados lancam em `open`, nao no `onerror`. Um fallback
    // alcancado por excecao falha na *primeira* chamada em vez de em todas.
    const { store } = await openProjectStore(deps(makeStorage(), new FakeIDBFactory({ throwOnOpen: true })));
    expect(store.kind).toBe('localstorage');
  });

  it('usa o armazenamento local quando o open fica bloqueado', async () => {
    const { store } = await openProjectStore(deps(makeStorage(), new FakeIDBFactory({ block: true })));
    expect(store.kind).toBe('localstorage');
  });

  it('no fallback, gravar e ler continua funcionando — como antes do D1', async () => {
    const storage = makeStorage();
    const { store } = await openProjectStore(deps(storage, null));
    const project = createBlankProject('Sem IndexedDB');

    expect((await store.write({ id: 'local', name: 'Sem IndexedDB', project })).kind).toBe('saved');
    expect((await store.read('local'))?.project.metadata.name).toBe('Sem IndexedDB');
    expect(await store.list()).toEqual([{ id: 'local', name: 'Sem IndexedDB', updatedAt: 0 }]);
  });

  it('no fallback, o ponteiro continua ser lido', async () => {
    const storage = makeStorage();
    const { store } = await openProjectStore(deps(storage, null));
    await store.write({ id: 'local', name: 'x', project: createBlankProject('x') });
    expect(readPointer(storage)?.name).toBe('x');
  });
});

describe('projectStore — ponteiro sem registro', () => {
  it('usa o slot legado quando o ponteiro aponta para algo que sumiu', async () => {
    // Base limpa no navegador, ponteiro preservado: abrir um editor vazio sobre um
    // projeto que o usuario espera ver é pior do que ler o legado.
    //
    // **Este `put` tem que funcionar.** A primeira versão usava um factory sem
    // falha nenhuma e ainda assim o teste não pegou a mutação que apaga a
    // reparação — porque o ramo de "não reparou" e o de "reparou" devolviam ambos
    // um store com o mesmo nome. O que realmente distingue os dois é *onde* o
    // projeto passa a estar, e isso só aparece com o IndexedDB funcionando.
    const storage = makeStorage({
      [POINTER_KEY]: JSON.stringify(pointer()),
      [LEGACY_SLOT_KEY]: JSON.stringify(createBlankProject('Do legado'))
    });
    const { store, pointer: p } = await openProjectStore(deps(storage, new FakeIDBFactory()));

    expect(store.kind).toBe('indexeddb');
    expect(p?.name).toBe('Do legado');
    expect((await store.read(p!.id))?.project.metadata.name).toBe('Do legado');
    // Reparou de verdade: o corpo foi para o IndexedDB, e não ficou só no legado.
    expect(await localStorageHas(storage, LEGACY_SLOT_KEY)).toBe(true);
  });

  it('fica no armazenamento local quando a reparação no IndexedDB falha', async () => {
    // O outro lado do mesmo par: se o IndexedDB não aceita o projeto, o store
    // devolvido tem que ser o que **tem** o dado. Devolver o IndexedDB aqui
    // devolveria `read(pointer.id) === null` sobre trabalho legível.
    const storage = makeStorage({
      [POINTER_KEY]: JSON.stringify(pointer()),
      [LEGACY_SLOT_KEY]: JSON.stringify(createBlankProject('Do legado'))
    });
    const { store, pointer: p } = await openProjectStore(
      deps(storage, new FakeIDBFactory({ failPutWith: 'QuotaExceededError' }))
    );

    expect(store.kind).toBe('localstorage');
    expect(p?.name).toBe('Do legado');
    expect((await store.read(p!.id))?.project.metadata.name).toBe('Do legado');
  });

  it('devolve ponteiro nulo quando nem o registro nem o legado existem', async () => {
    const { pointer: p } = await openProjectStore(
      deps(makeStorage({ [POINTER_KEY]: JSON.stringify(pointer()) }), new FakeIDBFactory())
    );
    expect(p).toBeNull();
  });

  it('reaproveita o ponteiro quando o registro existe', async () => {
    const factory = new FakeIDBFactory();
    const storage = makeStorage({ [POINTER_KEY]: JSON.stringify(pointer()) });

    const first = await openProjectStore(deps(storage, factory));
    await first.store.write({ id: 'p1', name: 'Meu Icone', project: createBlankProject('Meu Icone') });

    const second = await openProjectStore(deps(storage, factory));
    expect(second.pointer).toEqual(pointer());
    expect((await second.store.read('p1'))?.project.metadata.name).toBe('Meu Icone');
  });
});

describe('projectStore — o store nunca lanca', () => {
  it('trata um storage que lanca no getItem como vazio', async () => {
    const storage = {
      getItem: () => {
        throw new Error('storage bloqueado');
      },
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    // Um `getItem` que lança é raro mas existe — frame sandboxed, alguns modos
    // privados, storage já invalidado. O provider não pode morrer por isso no
    // startup: um storage que lança é um storage vazio.
    const { store, pointer: p } = await openProjectStore(deps(storage as never, new FakeIDBFactory()));
    expect(p).toBeNull();
    expect(store.kind).toBe('indexeddb');
    expect(await store.list()).toEqual([]);
  });

  it('não propaga erro de leitura no caminho de fallback', async () => {
    const storage = {
      getItem: () => {
        throw new Error('storage bloqueado');
      },
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const { store } = await openProjectStore(deps(storage as never, null));
    expect(await store.read('local')).toBeNull();
    expect(await store.list()).toEqual([]);
    await expect(store.remove('local')).resolves.toBe(true);
  });
});
