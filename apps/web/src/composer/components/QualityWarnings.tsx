import { useState, useMemo } from 'react';
import { AlertTriangle, Info, XCircle, CheckCircle2, ChevronUp } from 'lucide-react';
import { auditProject, type ValidationIssue } from '@iconcore/validator';
import { useComposer } from '../ComposerContext';

/**
 * A compact, non-invasive quality indicator for the sidebar. Collapsed to a
 * single chip (score + issue count); clicking expands a popover listing each
 * issue. Selecting an issue focuses its layer on the canvas. Replaces the old
 * panel that floated over the artwork.
 */
export const QualityWarnings = () => {
  const { state, dispatch } = useComposer();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const result = useMemo(() => {
    if (!state.project) return null;
    return auditProject(state.project);
  }, [state.project]);

  if (!result) return null;

  const visibleIssues = result.issues.filter((i) => !dismissed.has(i.code));
  const errors = visibleIssues.filter((i) => i.severity === 'error').length;
  const warnings = visibleIssues.filter((i) => i.severity === 'warning').length;

  const tone = errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'ok';

  const iconFor = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return <XCircle size={14} className="text-core-danger" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'info': return <Info size={14} className="text-core-muted" />;
    }
  };

  return (
    <div className="ic-quality-chip-wrap">
      {open && visibleIssues.length > 0 && (
        <div className="ic-quality-pop" role="dialog" aria-label="Quality issues">
          <div className="ic-quality-pop-head">
            <span>Quality ({result.score}/100)</span>
          </div>
          <div className="ic-quality-pop-list">
            {visibleIssues.map((issue) => (
              <div key={issue.code} className="ic-quality-issue">
                {iconFor(issue.severity)}
                <button
                  type="button"
                  className="ic-quality-issue-msg"
                  onClick={() => issue.layerId && dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: issue.layerId } })}
                  title={issue.layerId ? 'Select affected layer' : undefined}
                >
                  {issue.message}
                </button>
                <button
                  type="button"
                  className="ic-quality-issue-dismiss"
                  onClick={() => setDismissed((prev) => new Set([...prev, issue.code]))}
                  aria-label="Dismiss"
                >
                  <XCircle size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`ic-quality-chip is-${tone}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Icon quality check"
      >
        {tone === 'ok'
          ? <CheckCircle2 size={14} className="text-core-success" />
          : tone === 'error'
            ? <XCircle size={14} className="text-core-danger" />
            : <AlertTriangle size={14} className="text-yellow-500" />}
        <span className="ic-quality-score">{result.score}</span>
        {visibleIssues.length > 0 && (
          <span className="ic-quality-count">{visibleIssues.length}</span>
        )}
        {visibleIssues.length > 0 && <ChevronUp size={13} className={`ic-quality-caret ${open ? 'is-open' : ''}`} />}
      </button>
    </div>
  );
};
