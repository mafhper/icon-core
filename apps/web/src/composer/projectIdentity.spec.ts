import { describe, expect, it } from 'vitest';
import { composerReducer, initialState, type ComposerState } from './composerReducer';
import { createBlankProject } from './utils/projectFactory';

/**
 * The storage identity of the open project.
 *
 * Every assertion here was written **after** the bug, not before it, and each one
 * states the failure it prevents. The first is the one that mattered: without it,
 * "New project" wrote over the record of the project the user had open, which is
 * data loss that no test in the repository could see — the store suite had no id
 * concept, and the reducer had no storage concept.
 */
const comProjeto = (nome: string): ComposerState => ({
  ...initialState,
  project: createBlankProject(nome),
  projectId: 'p-aberto',
  view: 'edit-space'
});

describe('identidade do projeto no armazenamento', () => {
  it('NEW_PROJECT entrega uma identidade nova, nunca a do projeto aberto', () => {
    const antes = comProjeto('Meu Icone');
    expect(antes.projectId).toBe('p-aberto');

    const depois = composerReducer(antes, {
      type: 'NEW_PROJECT',
      payload: { name: 'Outro', size: 512 }
    });

    // The whole point: a different key, so the autosave cannot land on the old record.
    expect(depois.projectId).toBeTruthy();
    expect(depois.projectId).not.toBe('p-aberto');
  });

  it('cada NEW_PROJECT recebe uma identidade diferente', () => {
    const primeiro = composerReducer(comProjeto('A'), {
      type: 'NEW_PROJECT',
      payload: { name: 'B', size: 512 }
    });
    const segundo = composerReducer(primeiro, {
      type: 'NEW_PROJECT',
      payload: { name: 'C', size: 512 }
    });

    expect(segundo.projectId).not.toBe(primeiro.projectId);
  });

  it('abrir um arquivo sem id conhece uma identidade nova', () => {
    // O "Abrir" da CommandPalette monta o payload sem id; sem isto ele escreveria por
    // cima do projeto que já estava aberto.
    const depois = composerReducer(comProjeto('Meu Icone'), {
      type: 'LOAD_PROJECT',
      payload: createBlankProject('Do arquivo')
    });

    expect(depois.projectId).toBeTruthy();
    expect(depois.projectId).not.toBe('p-aberto');
  });

  it('o restore preserva a identidade do registro que leu', () => {
    // O oposto do caso anterior, e o que impede o autosave de criar uma segunda copia
    // do projeto que o usuario acabou de abrir.
    const depois = composerReducer(initialState, {
      type: 'LOAD_PROJECT',
      payload: { project: createBlankProject('Amanhã'), projectId: 'p-do-registro' }
    });

    expect(depois.projectId).toBe('p-do-registro');
  });

  it('editar o projeto mantem a identidade', () => {
    // O outro lado da distincao: uma edicao nao e um projeto novo. Se o id mudasse a
    // cada tecla, cada autosave criaria um registro.
    const antes = comProjeto('Meu Icone');
    expect(antes.isDirty).toBe(false);

    const depois = composerReducer(antes, {
      type: 'SET_DIRTY',
      payload: true
    });

    expect(depois.projectId).toBe('p-aberto');
  });

  it('o estado inicial nao tem identidade, e por isso nao salva nada', () => {
    // O guard do autosave e \`!id\`, nao \`!project\`: um estado sem identidade nao
    // tem onde gravar, e inventar um destino seria pior do que nao gravar.
    expect(initialState.projectId).toBeNull();
    expect(initialState.project).toBeNull();
  });
});
