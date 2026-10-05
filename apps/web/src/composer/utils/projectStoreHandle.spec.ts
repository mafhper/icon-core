import { describe, expect, it } from 'vitest';
import { FakeIDBFactory } from '../../test/fakeIndexedDb';
import { createBlankProject } from './projectFactory';
import { openProjectStore, type ProjectStore } from './projectStore';

/**
 * O store e o handle — e o teste que teria pego o defeito que o dono reportou.
 *
 * ## O defeito
 *
 * `Salvar` e `Salvar como` abriam **o mesmo seletor**. A causa nao estava no menu nem no
 * `Topbar`: o handle era **guardado e nunca lido de volta**, e o autosave o **apagava**.
 *
 * Duas metades do mesmo erro, e cada uma sozinha bastaria:
 *
 * 1. `write` e um `put`: o registro e substituido inteiro. Passar `{ id, name, project }`
 *    sem o handle apaga o vinculo — e o autosave dispara 2 s apos qualquer edicao.
 * 2. `read` devolvia o handle e os dois chamadores (`openStoredProject` e o
 *    restore-on-mount) o ignoravam, deixando `fileHandle` nulo apos qualquer reload.
 *
 * ## Por que este teste e no store, e nao no componente
 *
 * Porque o store e onde o `put` acontece, e e o store que pode ser exercitado sem
 * browser. Component-level exigiria um `FileSystemFileHandle` de verdade, que so se obtem
 * com um picker nativo — e o `IC63` ja registra que isso nao e automatizavel.
 *
 * ## O fixture e `createBlankProject`, e nao um objeto escrito a mao
 *
 * Porque `store.read` valida o documento com `parseProjectFile`. Um fixture escrito a mao
 * pode ser recusado, e o sintoma disso e `read` devolvendo `null` — que se parece com
 * "o handle foi perdido", e mandaria quem investiga para o lado errado. A primeira versao
 * deste arquivo escreveu o documento a mao e falhou assim.
 */

/** Um handle falso: so precisa de `name`, como qualquer coisa que o store guarda. */
const handleFalso = (name: string) => ({ name }) as unknown as FileSystemFileHandle;

const storeDeTeste = async (): Promise<ProjectStore> => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  } as unknown as Storage;

  const { store } = await openProjectStore({
    storage,
    factory: new FakeIDBFactory() as unknown as IDBFactory,
    now: () => 1000,
    newId: () => 'gerado-1'
  });
  return store;
};

describe('o store e o handle do arquivo', () => {
  it('guarda o handle e o devolve no read', async () => {
    const store = await storeDeTeste();
    await store.write({
      id: 'p1',
      name: 'Meu Icone',
      project: createBlankProject('Meu Icone'),
      handle: handleFalso('meu.icone.json')
    });

    const found = await store.read('p1');
    expect(found?.handle?.name).toBe('meu.icone.json');
  });

  /**
   * O que quebrou: um `write` **sem** handle substitui o registro e apaga o vinculo.
   *
   * Este e o teste do autosave. Sem o handle no payload, o `put` do segundo write removia
   * o handle que o primeiro tinha guardado — e o autosave faz exatamente esse segundo
   * write dois segundos depois de qualquer edicao.
   */
  it('um write sem handle APAGA o vinculo — por isso o autosave precisa manda-lo', async () => {
    const store = await storeDeTeste();
    const project = createBlankProject('Meu Icone');
    await store.write({ id: 'p1', name: 'Meu Icone', project, handle: handleFalso('meu.icone.json') });
    expect((await store.read('p1'))?.handle).toBeDefined();

    // O write do autosave, como estava antes da correcao.
    await store.write({ id: 'p1', name: 'Meu Icone', project });
    expect((await store.read('p1'))?.handle).toBeUndefined();
  });

  it('setHandle troca o vinculo sem tocar no documento', async () => {
    const store = await storeDeTeste();
    await store.write({ id: 'p1', name: 'Meu Icone', project: createBlankProject('Meu Icone') });

    expect(await store.setHandle('p1', handleFalso('novo.icone.json'))).toBe(true);

    const found = await store.read('p1');
    expect(found?.handle?.name).toBe('novo.icone.json');
    // O documento sobreviveu — um `put({ id, handle })` resolveria o problema apagando a
    // arte, que e o oposto do que se quer.
    expect(found?.project.metadata.name).toBe('Meu Icone');
  });

  it('setHandle(null) desliga o vinculo, e o documento fica', async () => {
    const store = await storeDeTeste();
    await store.write({
      id: 'p1',
      name: 'Meu Icone',
      project: createBlankProject('Meu Icone'),
      handle: handleFalso('a.json')
    });

    expect(await store.setHandle('p1', null)).toBe(true);
    const found = await store.read('p1');
    expect(found?.handle).toBeUndefined();
    expect(found?.project.metadata.name).toBe('Meu Icone');
  });

  it('setHandle em projeto inexistente devolve false, nao cria registro', async () => {
    const store = await storeDeTeste();
    expect(await store.setHandle('nao-existe', handleFalso('a.json'))).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });

  it('o vinculo sobrevive a varias escritas seguidas — o ciclo do autosave', async () => {
    const store = await storeDeTeste();
    const project = createBlankProject('Meu Icone');
    await store.write({ id: 'p1', name: 'Meu Icone', project, handle: handleFalso('a.json') });

    // Dez escritas como o autosave faria, cada uma levando o handle.
    for (let i = 0; i < 10; i++) {
      const atual = await store.read('p1');
      await store.write({ id: 'p1', name: 'Meu Icone', project, handle: atual?.handle });
    }
    expect((await store.read('p1'))?.handle?.name).toBe('a.json');
  });
});