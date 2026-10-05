import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadProject, projectFileName } from './projectStorage';

/**
 * Testes do download do projeto.
 *
 * O que estes testes seguram é uma **mentira**: o editor marcar "salvo" sem ter
 * salvo nada. O `SET_DIRTY(false)` vivia em dois lugares copiados, e nos dois rodava
 * mesmo sem projeto para baixar — de modo que um projeto nunca salvo aparecia como
 * salvo. `skipped` é a distinção que impede isso.
 */

/** Um `Document` mínimo: só o que `downloadProject` toca. */
const fakeDoc = () => {
  const anchor = { href: '', download: '', click: vi.fn() };
  return {
    anchor,
    doc: { createElement: () => anchor } as unknown as Document
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('projectFileName', () => {
  it('normaliza espacos e caixa, e sempre sai com a extensao do schema', () => {
    expect(projectFileName('Meu Projeto')).toBe('meu-projeto.iconcore.json');
    expect(projectFileName('IconCore')).toBe('iconcore.iconcore.json');
  });

  it('colapsa espacos repetidos em um hifen so', () => {
    expect(projectFileName('  Um   Projeto  ')).toBe('-um-projeto-.iconcore.json');
  });
});

describe('downloadProject', () => {
  it('dispara o download com o nome derivado do projeto', () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    const { anchor, doc } = fakeDoc();

    const r = downloadProject({ metadata: { name: 'Meu Projeto' } }, doc);

    expect(r).toEqual({ kind: 'downloaded', fileName: 'meu-projeto.iconcore.json' });
    expect(anchor.download).toBe('meu-projeto.iconcore.json');
    expect(anchor.href).toBe('blob:x');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('**não** baixa sem projeto, e diz por quê', () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    const { anchor, doc } = fakeDoc();

    expect(downloadProject(null, doc)).toEqual({ kind: 'skipped', reason: 'no-project' });
    expect(downloadProject(undefined, doc)).toEqual({ kind: 'skipped', reason: 'no-project' });
    // E o ponto do teste: nada clicked, logo o dirty **nao** pode ser limpo.
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('revoga a URL depois, e não no mesmo tick', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: revoke });
    const { doc } = fakeDoc();

    downloadProject({ metadata: { name: 'x' } }, doc);
    // No mesmo tick o Firefox ainda cancela o download.
    expect(revoke).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });

  it('manda o projeto inteiro como application/json', () => {
    // O `Blob` real do ambiente: `vi.fn(() => 'blob:x')` tipa como `never`, e um cast
    // para `Blob` seria mentira. Aqui so interessa o **tipo** enviado.
    const seen: Blob[] = [];
    const createObjectURL = vi.fn((part: Blob) => {
      seen.push(part);
      return 'blob:x';
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const { doc } = fakeDoc();

    downloadProject({ metadata: { name: 'Meu Projeto' } }, doc);

    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('application/json');
  });
});