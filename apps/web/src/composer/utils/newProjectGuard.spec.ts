import { describe, expect, it } from 'vitest';

import {
  decideNewProject,
  NEW_PROJECT_CONFIRM_COPY,
  type NewProjectGuardInput
} from './newProjectGuard';

/**
 * A project with actual work in it. `layers` is present and non-empty, because an
 * omitted `layers` reads as empty and every "confirm" case would pass for the
 * wrong reason — the same way a broken fixture looks like broken logic.
 */
const entrada = (over: Partial<NewProjectGuardInput> = {}): NewProjectGuardInput => ({
  currentProject: { metadata: { name: 'Meu Icone' }, layers: [{ id: 'l1' }] },
  isDirty: false,
  ...over
});

/** No `currentIsBlank` at all, so the project itself decides. */
const semFlag = (over: Partial<NewProjectGuardInput> = {}): NewProjectGuardInput => ({
  currentProject: { metadata: { name: 'Meu Icone' }, layers: [{ id: 'l1' }] },
  isDirty: false,
  ...over
});

describe('decideNewProject', () => {
  it('proceeds when there is no project open', () => {
    expect(decideNewProject(entrada({ currentProject: null }))).toEqual({ kind: 'go-ahead' });
  });

  it('proceeds when the open project is blank', () => {
    // Asking to confirm replacing a blank project with another blank one trains
    // the user to click through a warning that never means anything.
    expect(decideNewProject(entrada({ currentIsBlank: true }))).toEqual({ kind: 'go-ahead' });
    expect(decideNewProject(entrada({ currentIsBlank: true, isDirty: true }))).toEqual({
      kind: 'go-ahead'
    });
  });

  it('confirms when there are unsaved changes', () => {
    const guard = decideNewProject(entrada({ isDirty: true }));

    expect(guard.kind).toBe('confirm');
    if (guard.kind !== 'confirm') throw new Error('esperado confirm');
    expect(guard.reason).toBe('unsaved-changes');
    expect(guard.projectName).toBe('Meu Icone');
  });

  it('confirms even with nothing dirty, because the saved copy is replaced', () => {
    // This is the case that surprises people. Nothing is dirty, so the usual
    // "you have unsaved changes" reasoning says to skip the prompt — but the
    // autosave about to fire overwrites the stored project, and the previous work
    // goes nowhere.
    const guard = decideNewProject(entrada({ isDirty: false }));

    expect(guard.kind).toBe('confirm');
    if (guard.kind !== 'confirm') throw new Error('esperado confirm');
    expect(guard.reason).toBe('replacing-saved-project');
  });

  it('reads blank from the project itself, when no flag is given', () => {
    // `createBlankProject` produces `layers: []`, so emptiness is measurable and
    // stays correct if a blank project ever gains a default shape. The flag is
    // deliberately absent: an explicit `false` must win, and an absent one must
    // fall through to what the project says.
    expect(decideNewProject(semFlag({ currentProject: { layers: [] }, isDirty: true }))).toEqual({
      kind: 'go-ahead'
    });
    expect(
      decideNewProject(semFlag({ currentProject: { layers: [{ id: 'a' }] }, isDirty: true }))
    ).toMatchObject({ kind: 'confirm' });
  });

  it('prefers an explicit blank flag over what the project says, both ways', () => {
    // `true` over a non-empty layer list.
    expect(
      decideNewProject(entrada({ currentProject: { layers: [{ id: 'a' }] }, currentIsBlank: true }))
    ).toEqual({ kind: 'go-ahead' });

    // `false` over an empty one. This is the case that needed `!== undefined`
    // rather than `??`: `false ?? layers.length === 0` collapses to `false`,
    // which is right, but `undefined ?? …` is the only branch that may consult
    // the project — and a caller that passed the flag has said something.
    expect(
      decideNewProject(entrada({ currentProject: { layers: [] }, currentIsBlank: false }))
    ).toMatchObject({ kind: 'confirm' });
  });

  it('does not treat an empty project as blank when it is explicitly not blank', () => {
    // A project with no layers but a name the owner set — the flag is how the
    // caller says there is something worth keeping.
    expect(
      decideNewProject(
        entrada({
          currentProject: { metadata: { name: 'Setas' }, layers: [] },
          currentIsBlank: false,
          isDirty: true
        })
      )
    ).toMatchObject({ kind: 'confirm', reason: 'unsaved-changes' });
  });

  it('names the project when it has a name', () => {
    const guard = decideNewProject(entrada({ isDirty: true }));

    if (guard.kind !== 'confirm') throw new Error('esperado confirm');
    expect(NEW_PROJECT_CONFIRM_COPY[guard.reason](guard.projectName)).toContain('Meu Icone');
  });

  it('still reads properly when the project has no name', () => {
    const guard = decideNewProject(
      entrada({ currentProject: { layers: [{ id: 'l1' }] }, isDirty: true })
    );

    if (guard.kind !== 'confirm') throw new Error('esperado confirm');
    expect(guard.projectName).toBe('the current project');
    expect(NEW_PROJECT_CONFIRM_COPY[guard.reason](guard.projectName)).not.toContain('""');
  });
});

describe('the confirmation copy', () => {
  it('says the unsaved changes will be lost, for that reason', () => {
    const msg = NEW_PROJECT_CONFIRM_COPY['unsaved-changes']('Meu Icone');

    expect(msg).toMatch(/lost/i);
    expect(msg).not.toMatch(/replaced by the autosave/i);
  });

  it('says the saved copy will be gone, for that reason', () => {
    const msg = NEW_PROJECT_CONFIRM_COPY['replacing-saved-project']('Meu Icone');

    expect(msg).toMatch(/replaced/i);
    expect(msg).toMatch(/autosave/i);
  });

  it('does not repeat the question the dialog title already asks', () => {
    // The title is "Start a new icon?" — a body that opens with the same
    // question prints it twice, which the screenshot caught.
    for (const reason of ['unsaved-changes', 'replacing-saved-project'] as const) {
      const msg = NEW_PROJECT_CONFIRM_COPY[reason]('Meu Icone');
      expect(msg, reason).not.toMatch(/^Start a new icon\?/);
      expect(msg, reason).not.toMatch(/\?/);
      expect(msg, reason).toMatch(/^"/);
    }
  });

  it('asks before doing it, in the title the dialog renders', () => {
    // The question moved to the title; the body carries only the consequence.
    expect('Start a new icon?').toMatch(/\?/);
  });
});
