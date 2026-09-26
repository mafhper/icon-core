import { useCallback, useMemo, useState } from 'react';
import type { ExportArtifact, ExportContext, ExportPlan, IconVariant } from '@iconcore/shared';
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
  context: ExportContext;
}

/**
 * EX5 — owns the editable export plan for the Export view.
 *
 * The plan lives in local state (not the project) while the user edits it;
 * persisting the snapshot into `project.exportProfile` is EX6's job, so this
 * hook deliberately has no side effect on the project. Everything it mutates is
 * a pure `planAction`, which keeps the behaviour testable without React.
 */
export const useExportPlan = (): ExportPlanController => {
  const { state } = useComposer();
  const project = state.project;

  const context = useMemo<ExportContext | null>(
    () => (project ? { project, variants: Object.keys(project.variants) as IconVariant[] } : null),
    [project]
  );

  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [variants, setVariants] = useState<IconVariant[]>([state.activeVariant]);

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

  const dispatch = useCallback(
    (action: Parameters<typeof planAction>[2]) => {
      if (!context) return;
      setPlan((previous) => planAction(previous ?? initialPlan(context), context, action));
    },
    [context]
  );

  const actions = useMemo<PlanActions>(
    () => ({
      setPreset: (presetId) => dispatch({ type: 'setPreset', presetId }),
      customize: () => dispatch({ type: 'customize' }),
      setArtifact: (id, patch: Partial<ExportArtifact>) => dispatch({ type: 'setArtifact', id, patch }),
      toggleArtifact: (id) => dispatch({ type: 'toggleArtifact', id }),
      removeArtifact: (id) => dispatch({ type: 'removeArtifact', id }),
      duplicateArtifact: (id) => dispatch({ type: 'duplicateArtifact', id }),
      addArtifact: (format) => dispatch({ type: 'addArtifact', format }),
      setEntries: (id, entries) => dispatch({ type: 'setEntries', id, entries }),
      toggleEntry: (id, entry) => dispatch({ type: 'toggleEntry', id, entry }),
      setVariants,
      reset: () => setPlan(null)
    }),
    [dispatch]
  );

  const validation = useMemo(
    () => (context && current ? validatePlan(current, context) : { ready: false, problems: [], warnings: [] }),
    [context, current]
  );

  return {
    plan: current ?? { artifacts: [], attachments: [] },
    actions,
    validation,
    presets: getAllPresets(),
    variants,
    setVariants,
    context: context ?? ({ project: undefined } as unknown as ExportContext)
  };
};
