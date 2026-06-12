import { useState, useMemo } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { auditProject, type ValidationIssue } from '@iconcore/validator';
import { useComposer } from '../ComposerContext';

export const QualityWarnings = () => {
  const { state } = useComposer();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const result = useMemo(() => {
    if (!state.project) return null;
    return auditProject(state.project);
  }, [state.project]);

  if (!result || result.issues.length === 0) return null;

  const visibleIssues = result.issues.filter(i => !dismissed.has(i.code));
  if (visibleIssues.length === 0) return null;

  const iconFor = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return <XCircle size={14} className="text-core-danger" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'info': return <Info size={14} className="text-core-muted" />;
    }
  };

  return (
    <div className="border-t border-core-border bg-core-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-core-muted">
          Quality ({result.score}/100)
        </span>
      </div>
      {visibleIssues.map((issue) => (
        <div
          key={issue.code}
          className="flex items-start gap-2 text-xs"
        >
          {iconFor(issue.severity)}
          <span className="flex-1 text-core-muted">{issue.message}</span>
          <button
            type="button"
            onClick={() => setDismissed(prev => new Set([...prev, issue.code]))}
            className="text-core-muted hover:text-core-text"
          >
            <XCircle size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};