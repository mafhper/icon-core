/**
 * Whether starting a new project needs a confirmation.
 *
 * `NEW_PROJECT` builds a blank project and marks the state dirty, which means the
 * autosave overwrites the slot about two seconds later. The previous work does not
 * go anywhere — measured, not assumed: there is one slot, and nothing archives it
 * before the write.
 *
 * So the question is not "is this destructive in principle" but "is there something
 * to lose". A brand-new workspace has nothing, and asking there would train the
 * user to click through a warning that never means anything.
 */
export interface NewProjectGuardInput {
  /** The project currently open, if any. */
  currentProject: { metadata?: { name?: string }; layers?: unknown[] } | null | undefined;
  /** True when the open project has edits that were never written. */
  isDirty: boolean;
  /**
   * Whether the open project is itself a blank, freshly created one. Asking to
   * confirm replacing a blank project with another blank project is noise.
   *
   * Measured rather than tracked: `createBlankProject` produces `layers: []`, and
   * a blank project carries nothing else worth keeping. An explicit flag would
   * drift the moment a blank project gains a default shape.
   */
  currentIsBlank?: boolean;
}

export type NewProjectGuard =
  | { kind: 'go-ahead' }
  | { kind: 'confirm'; projectName: string; reason: 'unsaved-changes' | 'replacing-saved-project' };

/**
 * Decide what "New project" should do.
 *
 * Two situations warn, for different reasons:
 *
 * - **unsaved-changes** — there are edits in memory that are not in storage. A
 *   confirmation that is not acknowledged loses them outright.
 * - **replacing-saved-project** — the open project *is* the autosaved one, so
 *   there are no unsaved edits, but starting over still overwrites what was
 *   saved. This is the case that surprises people: nothing is dirty, so the usual
 *   "you have unsaved changes" reasoning says to skip the prompt.
 *
 * Everything else proceeds. Being asked to confirm when there is nothing at stake
 * makes the warning stop meaning anything.
 */
export const decideNewProject = (input: NewProjectGuardInput): NewProjectGuard => {
  const nome = input.currentProject?.metadata?.name?.trim();

  // A blank project is not work. Replacing it costs nothing.
  //
  // An explicit `currentIsBlank` wins, **including when it is `false`** — which
  // is why this cannot use `??`: `false ?? x` is `false`, but `undefined ?? x` is
  // `x`, and the caller that bothered to pass the flag has said something. Only
  // an absent flag falls through to the project itself.
  const emBranco =
    input.currentIsBlank !== undefined
      ? input.currentIsBlank
      : (input.currentProject?.layers?.length ?? 0) === 0;

  if (!input.currentProject || emBranco) {
    return { kind: 'go-ahead' };
  }

  if (input.isDirty) {
    return {
      kind: 'confirm',
      projectName: nome || 'the current project',
      reason: 'unsaved-changes'
    };
  }

  // Open, saved, and not blank: starting over replaces the autosaved copy.
  return {
    kind: 'confirm',
    projectName: nome || 'the current project',
    reason: 'replacing-saved-project'
  };
};

/**
 * The body of the confirmation.
 *
 * The dialog already carries a title that asks the question, so these start with
 * the consequence rather than repeating it — the first version read "Start a new
 * icon? … Start a new icon? …" in two consecutive lines, which the screenshot
 * caught immediately.
 */
export const NEW_PROJECT_CONFIRM_COPY = {
  'unsaved-changes': (projectName: string): string =>
    `"${projectName}" has changes that are not saved yet, and they will be lost.`,

  'replacing-saved-project': (projectName: string): string =>
    `"${projectName}" will be replaced by the autosave, and the saved copy will be gone.`
} as const;
