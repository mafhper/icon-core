import { describe, expect, it, vi } from 'vitest';
import { planSave, supportsFileSystemAccess, writeThroughHandle, type FileHandleLike } from './fileSave';

/**
 * Testes do `Save` em disco.
 *
 * O criterio nao e "grava o arquivo" — isso exige um handle real e um gesto do usuario.
 * E que a funcao **nunca minta**: um `saved` falso limpa o dirty e faz o dono acreditar
 * que o trabalho esta no disco quando nao esta. E o `IC-N4`, Sintoma 2, de novo.
 */

/** Handle de teste. `granted` controla `queryPermission`. */
const handle = (
  name: string,
  opts: {
    granted?: boolean;
    onWrite?: (data: string) => void;
    failOn?: 'create' | 'write' | 'close';
    semPermission?: boolean;
  } = {}
): FileHandleLike & { writable: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } } => {
  const writable = {
    write: vi.fn(async (data: string) => {
      if (opts.failOn === 'write') throw new Error('disco cheio');
      opts.onWrite?.(data);
    }),
    close: vi.fn(async () => {
      if (opts.failOn === 'close') throw new Error('close falhou');
    })
  };
  const h: FileHandleLike & { writable: typeof writable } = {
    name,
    writable,
    createWritable: async () => {
      if (opts.failOn === 'create') throw new Error('sem permissão');
      return writable;
    }
  };
  if (!opts.semPermission) {
    h.queryPermission = async () =>
      opts.granted === false ? ('prompt' as PermissionState) : ('granted' as PermissionState);
  }
  return h;
};

const projeto = { schemaVersion: 3, metadata: { name: 'Meu Icone' }, canvas: { size: 512 } };

describe('supportsFileSystemAccess', () => {
  it('exige os dois pickers: um so nao serve', () => {
    expect(supportsFileSystemAccess({ showOpenFilePicker: () => {}, showSaveFilePicker: () => {} })).toBe(true);
    expect(supportsFileSystemAccess({ showOpenFilePicker: () => {} })).toBe(false);
    expect(supportsFileSystemAccess({})).toBe(false);
  });
});

describe('writeThroughHandle', () => {
  it('escreve e fecha', async () => {
    const escrito: string[] = [];
    const h = handle('a.json', { onWrite: (d) => escrito.push(d) });
    const r = await writeThroughHandle(h, 'conteudo');
    expect(r).toEqual({ ok: true });
    expect(escrito).toEqual(['conteudo']);
    expect(h.writable.close).toHaveBeenCalledTimes(1);
  });

  it('fecha mesmo quando a escrita lanca — e devolve o erro', async () => {
    const h = handle('a.json', { failOn: 'write' });
    const r = await writeThroughHandle(h, 'x');
    expect(r.ok).toBe(false);
    expect(h.writable.close).toHaveBeenCalled();
  });

  it('propaga a falha de createWritable sem inventar escrita', async () => {
    const h = handle('a.json', { failOn: 'create' });
    const r = await writeThroughHandle(h, 'x');
    expect(r).toEqual({ ok: false, error: 'Error' });
    expect(h.writable.write).not.toHaveBeenCalled();
  });
});

describe('planSave', () => {
  it('grava no handle do projeto e diz que salvou', async () => {
    const escrito: string[] = [];
    const r = await planSave(projeto, handle('meu.icone.iconcore.json', { onWrite: (d) => escrito.push(d) }));
    expect(r).toEqual({ kind: 'saved', fileName: 'meu.icone.iconcore.json', how: 'save' });
    expect(JSON.parse(escrito[0]).metadata.name).toBe('Meu Icone');
  });

  it('**nao** salva sem projeto, e o dirty fica', async () => {
    expect(await planSave(null, handle('a.json'))).toEqual({ kind: 'skipped', reason: 'no-project' });
  });

  it('**nao** salva sem handle: e nao baixa nada', async () => {
    // Este e o ponto. Um `Save` sem handle nao pode virar download silencioso: o
    // dono abriria um arquivo novo e acharia que salvou o que estava editando.
    const r = await planSave(projeto, null);
    expect(r).toEqual({ kind: 'skipped', reason: 'no-handle' });
  });

  it('permissao em `prompt` pede gesto, sem escrever', async () => {
    const h = handle('a.json', { granted: false });
    const r = await planSave(projeto, h);
    expect(r).toEqual({ kind: 'needs-permission', fileName: 'a.json', retryAs: 'save' });
    expect(h.writable.write).not.toHaveBeenCalled();
  });

  it('permissao `denied` manda para Save as — porque clicar em Save nao adianta', async () => {
    const h = handle('a.json');
    h.queryPermission = async () => 'denied' as PermissionState;
    expect(await planSave(projeto, h)).toEqual({ kind: 'needs-permission', fileName: 'a.json', retryAs: 'save-as' });
  });

  it('queryPermission que lanca cai em `prompt`, e nao em erro', async () => {
    const h = handle('a.json');
    h.queryPermission = async () => {
      throw new Error('engine estranho');
    };
    // Conservador: pedir permissao e sempre seguro; falhar a save nao e.
    expect(await planSave(projeto, h)).toEqual({ kind: 'needs-permission', fileName: 'a.json', retryAs: 'save' });
  });

  it('handle sem queryPermission escreve direto (o duplo nao tem esse metodo)', async () => {
    const r = await planSave(projeto, handle('a.json', { semPermission: true }));
    expect(r).toEqual({ kind: 'saved', fileName: 'a.json', how: 'save' });
  });

  it('falha de disco devolve `failed`, nunca `saved`', async () => {
    const r = await planSave(projeto, handle('a.json', { failOn: 'write' }));
    expect(r.kind).toBe('failed');
    expect(r.kind === 'failed' && r.error).toBeTruthy();
  });
});