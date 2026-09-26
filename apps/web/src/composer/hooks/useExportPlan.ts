import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExportArtifact, ExportContext, ExportDestination, ExportPlan, IconVariant } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { getAllPresets, validatePlan } from '@iconcore/exporters';
import { initialPlan, planAction, type PlanActions } from '../utils/exportPlanState';

export interface ExportPlanController {
  plan: ExportPlan;
  actions: PlanActions;
  /** Structural + nature validation (spec §6), recomputed on every edit. */
  validation: ReturnType<typeof validatePlan>;
  /** Presets available in the picker, in registry order. */
  presets: ReturnType<typeof getAllPresets>;
  /** Variants selected for batch expansion (artifacts with an explicit variant ignore it). */
  variants: IconVariant[];
  setVariants: (variants: IconVariant[]) => void;
  /** Transport destination (persisted separately from the plan). */
  destination: ExportDestination;
  setDestination: (destination: ExportDestination) => void;
  /** Flush the current plan into `project.exportProfile` (call before leaving). */
  persist: () => void;
  context: ExportContext;
}

/**
 * EX5 + EX6 — owns the editable export plan for the Export view and mirrors it
 * into `project.exportProfile` so reopening restores it (spec §8).
 *
 * The plan lives in local state while the user edits it; persistence is
 * debounced so a slider or a rename does not write the project on every
 * keystroke. Everything it mutates is a pure `planAction`, which keeps the
 * behaviour testable without React.
 */
export const useExportPlan = (): ExportPlanController => {
  const { state, dispatch } = useComposer();
  const project = state.project;

  const context = useMemo<ExportContext | null>(
    () => (project ? { project, variants: Object.keys(project.variants) as IconVariant[] } : null),
    [project]
  );

  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [variants, setVariants] = useState<IconVariant[]>([state.activeVariant]);
  const [destination, setDestination] = useState<ExportDestination>(
    project?.exportProfile.destination ?? (project?.exportProfile.zip === false ? 'files' : 'zip')
  );

  // Seed once per project: a persisted snapshot wins, else bridge the legacy
  // targets, else the web preset. Recomputing on every render would discard
  // the user's edits.
  const seeded = useMemo<ExportPlan | null>(() => {
    if (!context) return null;
    return initialPlan(context, {
      presetId: project?.exportProfile.presetId,
      artifacts: project?.exportProfile.artifacts
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per project
  }, [context?.project]);

  const current = plan ?? seeded;

  const applyAction = useCallback(
    (action: Parameters<typeof planAction>[2]) => {
      if (!context) return;
      setPlan((previous) => planAction(previous ?? initialPlan(context), context, action));
    },
    [context]
  );

  const actions = useMemo<PlanActions>(
    () => ({
      setPreset: (presetId) => applyAction({ type: 'setPreset', presetId }),
      customize: () => applyAction({ type: 'customize' }),
      setArtifact: (id, patch: Partial<ExportArtifact>) => applyAction({ type: 'setArtifact', id, patch }),
      toggleArtifact: (id) => applyAction({ type: 'toggleArtifact', id }),
      removeArtifact: (id) => applyAction({ type: 'removeArtifact', id }),
      duplicateArtifact: (id) => applyAction({ type: 'duplicateArtifact', id }),
      addArtifact: (format) => applyAction({ type: 'addArtifact', format }),
      setEntries: (id, entries) => applyAction({ type: 'setEntries', id, entries }),
      toggleEntry: (id, entry) => applyAction({ type: 'toggleEntry', id, entry }),
      toggleAttachment: (path) => applyAction({ type: 'toggleAttachment', path }),
      setVariants,
      reset: () => setPlan(null)
    }),
    [applyAction]
  );

  const validation = useMemo(
    () =>
      context && current
        ? validatePlan(current, context, { variants })
        : { ready: false, problems: [], warnings: [] },
    [context, current, variants]
  );

  /**
   * EX6 persistence: mirror the edited plan into the project. Debounced so
   * typing a path or dragging the compression slider does not write the project
   * (and mark it dirty) on every change; a flush is forced on unmount.
   */
  const currentRef = useRef(current);
  currentRef.current = current;

  const persist = useCallback(() => {
    const snapshot = currentRef.current;
    if (!snapshot) return;
    dispatch({
      type: 'UPDATE_EXPORT_PROFILE',
      payload: {
        presetId: snapshot.presetId,
        artifacts: snapshot.artifacts,
        destination
      }
    });
  }, [dispatch, destination]);

  useEffect(() => {
    if (!plan) return; // nothing edited yet — do not dirty the project
    const timer = setTimeout(persist, 600);
    return () => clearTimeout(timer);
  }, [plan, destination, persist]);

  return {
    plan: current ?? { artifacts: [], attachments: [] },
    actions,
    validation,
    presets: getAllPresets(),
    variants,
    setVariants,
    destination,
    setDestination,
    persist,
    context: context ?? ({ project: undefined } as unknown as ExportContext)
  };
};
