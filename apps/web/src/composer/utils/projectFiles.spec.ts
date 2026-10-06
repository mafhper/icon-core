import { describe, expect, it, vi } from 'vitest';
import {
  openWithFileSystemAccess,
  saveProjectWithFileSystemAccess,
  type FileSystemAccessScope
} from './projectFiles';

/**
 * Testes dos dois fluxos de salvar.
 *
 * O `showOpenFilePicker`, o `showSaveFilePicker` e o `requestPermission` **não são
 * automatizáveis**: os dois primeiros abrem diálogo nativo, e o terceiro exige gesto do
 * usuário. Playwright não dirige nenhum. Então estes testes injetam um `scope` falso e
 * cobrem a **decisão** — qual picker, o que acontece se for cancelado, o que acontece se
 * o FSA não existir.
 *
 * O que fica sem prova é o caminho dentro do diálogo nativo, e isso está dito no
 * `IC63`: a afirmação não entra no critério de aceitação.
 */
const projeto = { schemaVersion: 3, metadata: { name: 'Meu Icone', shortName: 'Meu' }, canvas: { size: 512 } };
const parse = (text: string) => JSON.parse(text) as unknown;

/**
 * O duplo de um handle.
 *
 * `getFile` **não é opcional**: `openWithFileSystemAccess` lê o texto por ele, e um
 * duplo sem esse método cai em `invalid` — a primeira versao deste arquivo passou 10 de
 * 12 porque o duplo sabia gravar mas não sabia ler, e o fluxo de abrir é justamente o
 * que lê.
 */
const handleFalso = (name: string, conteudo = JSON.stringify(projeto)) => ({
  name,
  queryPermission: async () => 'granted' as PermissionState,
  getFile: async () => ({ text: async () => conteudo }) as unknown as File,
  createWritable: async () => ({
    write: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined)
  })
});

const scopeCom = (over: Partial<FileSystemAccessScope> = {}): FileSystemAccessScope => ({
  showOpenFilePicker: async () => [handleFalso('meu.icone.json')],
  showSaveFilePicker: async () => handleFalso('novo.icone.json'),
  ...over
});

describe('openWithFileSystemAccess', () => {
  it('sem FSA, diz unsupported — o chamador cai para <input>', async () => {
    // Firefox nao tem FSA. E o app precisa funcionar la, entao isto e um caminho, nao
    // um erro.
    const r = await openWithFileSystemAccess(parse, {});
    expect(r).toEqual({ kind: 'unsupported' });
  });

  it('so o showSaveFilePicker nao basta para abrir', async () => {
    // `supportsFileSystemAccess` exige os dois. Abrir sem poder gravar seria abrir um
    // arquivo que "Salvar" nao consegue reescrever — e a pessoa perderia o trabalho sem
    // aviso.
    const r = await openWithFileSystemAccess(parse, { showSaveFilePicker: async () => handleFalso('x.json') });
    expect(r).toEqual({ kind: 'unsupported' });
  });

  it('devolve projeto, nome E handle — o handle e o que permite o Salvar no lugar', async () => {
    const r = await openWithFileSystemAccess(parse, scopeCom());
    expect(r.kind).toBe('opened');
    if (r.kind !== 'opened') return;
    expect(r.fileName).toBe('meu.icone.json');
    expect(r.handle).toBeDefined();
    expect(typeof r.handle.createWritable).toBe('function');
  });

  it('picker dispensado e cancelled, nao erro', async () => {
    const r = await openWithFileSystemAccess(parse, scopeCom({
      showOpenFilePicker: async () => {
        throw Object.assign(new Error('x'), { name: 'AbortError' });
      }
    }));
    expect(r).toEqual({ kind: 'cancelled' });
  });

  it('JSON invalido diz invalid com o nome do arquivo', async () => {
    const r = await openWithFileSystemAccess(
      () => null,
      scopeCom()
    );
    expect(r).toEqual({ kind: 'invalid', fileName: 'meu.icone.json', reason: 'formato' });
  });

  it('getFile que falha nao derruba o app', async () => {
    const quebrado = { name: 'a.json', createWritable: vi.fn() };
    const r = await openWithFileSystemAccess(parse, scopeCom({
      showOpenFilePicker: async () => [quebrado as never]
    }));
    expect(r.kind).toBe('invalid');
  });
});

describe('saveProjectWithFileSystemAccess', () => {
  it('oferece o picker, e nao baixa', async () => {
    // Este e o teste que cobre o defeito que o dono reportou: o "Save as" antigo
    // chamava `downloadProject`, que **baixa**. Aqui o picker e chamado.
    const showSaveFilePicker = vi.fn(async () => handleFalso('novo.icone.json'));
    const r = await saveProjectWithFileSystemAccess(projeto, 'novo.icone.json', scopeCom({ showSaveFilePicker }));

    expect(showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ kind: 'saved', fileName: 'novo.icone.json' });
  });

  it('oferece o nome sugerido e a extensao do schema', async () => {
    const recebido: { suggestedName?: string }[] = [];
    const showSaveFilePicker = async (options?: unknown) => {
      recebido.push(options as { suggestedName?: string });
      return handleFalso('x.json');
    };
    await saveProjectWithFileSystemAccess(projeto, 'meu.icone.json', scopeCom({ showSaveFilePicker }));

    expect(recebido[0]?.suggestedName).toBe('meu.icone.json');
  });

  it('dispenser e cancelled — nao erro, e nao "salvo"', async () => {
    const r = await saveProjectWithFileSystemAccess(projeto, 'x.json', scopeCom({
      showSaveFilePicker: async () => {
        throw Object.assign(new Error('x'), { name: 'AbortError' });
      }
    }));
    expect(r).toEqual({ kind: 'cancelled' });
  });

  it('falha de escrita e failed, nunca saved', async () => {
    // `saved` falso faria o dirty limpar e a pessoa acreditaria que o trabalho esta no
    // disco. E a Sintoma 2 do IC-N4 de novo.
    const handle = {
      name: 'x.json',
      createWritable: async () => ({
        write: async () => {
          throw new Error('disco cheio');
        },
        close: async () => undefined
      })
    };
    const r = await saveProjectWithFileSystemAccess(projeto, 'x.json', scopeCom({
      showSaveFilePicker: async () => handle as never
    }));
    expect(r.kind).toBe('failed');
  });

  it('sem FSA, unsupported — e o chamador pode cair para o download', async () => {
    const r = await saveProjectWithFileSystemAccess(projeto, 'x.json', {});
    expect(r).toEqual({ kind: 'unsupported' });
  });

  it('o handle devolvido e o que passa a valer no Salvar seguinte', async () => {
    // E o que fecha o ciclo: depois de um "Save as", `Salvar` grava no caminho escolhido.
    const r = await saveProjectWithFileSystemAccess(projeto, 'x.json', scopeCom());
    expect(r.kind).toBe('saved');
    if (r.kind !== 'saved') return;
    expect(typeof r.handle.createWritable).toBe('function');
    expect(r.handle.name).toBe('novo.icone.json');
  });
});