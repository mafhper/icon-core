import { describe, expect, it } from 'vitest';
import { describeProjectRow } from './projectRows';
import { composerReducer, initialState } from '../composerReducer';
import { createBlankProject } from '../utils/projectFactory';

/**
 * `D2` — the stored-project list.
 *
 * Two halves with different reasons to exist. The row text is **presentation
 * logic in a component's tree**, which is where it becomes untestable and then
 * untested; the rename is a state transition whose whole point is that it does not
 * mint a new project, which is the defect #202 was about.
 */
describe('describeProjectRow', () => {
  const agora = Date.now();
  const comIdade = (minutos: number) => ({ name: 'P', updatedAt: agora - minutos * 60_000 });

  it('diz "just now" para o que acabou de ser salvo', () => {
    expect(describeProjectRow(comIdade(0))).toBe('just now');
    expect(describeProjectRow(comIdade(0.4))).toBe('just now');
  });

  it('conta minutos ate a hora', () => {
    expect(describeProjectRow(comIdade(1))).toBe('1 min ago');
    expect(describeProjectRow(comIdade(59))).toBe('59 min ago');
  });

  it('conta horas ate o dia', () => {
    expect(describeProjectRow(comIdade(60))).toBe('1 h ago');
    expect(describeProjectRow(comIdade(60 * 23))).toBe('23 h ago');
  });

  it('conta dias ate o mes', () => {
    expect(describeProjectRow(comIdade(60 * 24))).toBe('1 d ago');
    expect(describeProjectRow(comIdade(60 * 24 * 29))).toBe('29 d ago');
  });

  it('vira data depois de um mes, onde "ago" deixa de ajudar', () => {
    // 40 days in milliseconds. The first draft wrote `60 * 24 * 40 * 1000`, which is
    // 16 **hours** — the test failed on its own arithmetic and looked like a bug in
    // the formatter.
    const DIA = 24 * 60 * 60 * 1000;
    const antigo = { name: 'P', updatedAt: agora - 40 * DIA };
    // Absolute, because "40 d ago" is a worse answer than a date for something the
    // user has not touched in six weeks.
    expect(describeProjectRow(antigo)).toMatch(/\d/);
    expect(describeProjectRow(antigo)).not.toMatch(/ago/);
  });

  it('nao quebra com um timestamp no futuro', () => {
    // Um relogio adiantado, ou um registro gravado por outra maquina. A lista nao pode
    // renderizar "NaN min ago".
    const futuro = { name: 'P', updatedAt: agora + 60_000 };
    expect(describeProjectRow(futuro)).toBe('just now');
  });
});

describe('SET_PROJECT_NAME', () => {
  const comProjeto = () => ({
    ...initialState,
    project: createBlankProject('Antigo'),
    projectId: 'p-aberto',
    view: 'edit-space' as const
  });

  it('renomeia o projeto no documento', () => {
    const depois = composerReducer(comProjeto(), { type: 'SET_PROJECT_NAME', payload: 'Novo' });
    expect(depois.project?.metadata.name).toBe('Novo');
    expect(depois.project?.metadata.shortName).toBe('Antigo');
  });

  it('preserva a identidade — renomear nao e criar projeto', () => {
    // Este e o ponto. O #202 corrigiu "Novo projeto" sobrescrevendo o registro
    // anterior; um rename que cunhasse id reproduciria o mesmo defeito, e a lista de
    // projetos e exatamente onde ele apareceria de novo.
    const antes = comProjeto();
    const depois = composerReducer(antes, { type: 'SET_PROJECT_NAME', payload: 'Novo' });
    expect(depois.projectId).toBe(antes.projectId);
  });

  it('marca o projeto como sujo, para o autosave gravar o nome novo', () => {
    // Sem isto o nome mudaria na tela e nunca chegaria ao armazenamento, e a lista
    // voltaria com o nome antigo na proxima sessao.
    const depois = composerReducer(comProjeto(), { type: 'SET_PROJECT_NAME', payload: 'Novo' });
    expect(depois.isDirty).toBe(true);
  });

  it('ignora um nome vazio ou igual ao atual', () => {
    const antes = comProjeto();
    expect(composerReducer(antes, { type: 'SET_PROJECT_NAME', payload: '   ' })).toBe(antes);
    expect(composerReducer(antes, { type: 'SET_PROJECT_NAME', payload: 'Antigo' })).toBe(antes);
  });

  it('nao faz nada sem projeto aberto', () => {
    const depois = composerReducer(initialState, { type: 'SET_PROJECT_NAME', payload: 'Novo' });
    expect(depois).toBe(initialState);
  });
});
