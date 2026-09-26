import { FileCode2, FileJson, FileText, Globe, Info } from 'lucide-react';
import type { ExportPlan } from '@iconcore/shared';
import { attachmentLabel, canDisableAttachment } from '../../utils/exportPlanState';

export interface CompanionFilesProps {
  plan: ExportPlan;
  onToggle: (path: string) => void;
}

const ICON_FOR = {
  manifest: Globe,
  browserconfig: Globe,
  report: FileJson,
  preview: FileCode2,
  readme: FileText
} as const;

/**
 * The non-icon files the plan declares (ADR-014 invariant: every produced file
 * is an enabled artifact **or an enabled declared attachment**).
 *
 * They are listed here — not appended silently at execution time — so a plan
 * that means "just the .ico" can actually be just the .ico. Integration files
 * (`manifest`, `browserconfig`) belong to the target and cannot be switched off;
 * documentation companions can.
 */
export const CompanionFiles = ({ plan, onToggle }: CompanionFilesProps) => {
  if (plan.attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.78rem] font-semibold text-ic-text-muted">Also include</h3>
        <span className="text-[0.72rem] text-ic-text-faint">
          {plan.attachments.filter((a) => a.enabled !== false).length} of {plan.attachments.length}
        </span>
      </div>

      <ul className="flex flex-col gap-1 list-none p-0">
        {plan.attachments.map((attachment) => {
          const on = attachment.enabled !== false;
          const locked = !canDisableAttachment(attachment.generator);
          const Icon = ICON_FOR[attachment.generator];
          return (
            <li
              key={attachment.path}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-ic-border bg-ic-bg px-2.5 py-1.5"
            >
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={() => onToggle(attachment.path)}
                  aria-label={`Include ${attachment.path}`}
                />
              </label>

              <span className="flex min-w-0 items-center gap-2">
                <Icon size={14} className="shrink-0 text-ic-text-faint" />
                <span className="min-w-0">
                  <span className="block truncate text-[0.8rem] text-ic-text">{attachmentLabel(attachment.generator)}</span>
                  <span className="block truncate text-[0.7rem] text-ic-text-faint">{attachment.path}</span>
                </span>
              </span>

              {locked ? (
                <span
                  className="flex items-center gap-1 text-[0.68rem] text-ic-text-faint"
                  title="Part of the integration — removing it breaks the target"
                >
                  <Info size={11} />
                  required
                </span>
              ) : (
                <span className="text-[0.68rem] text-ic-text-faint">optional</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
