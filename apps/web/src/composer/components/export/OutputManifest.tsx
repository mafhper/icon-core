export interface OutputManifestProps {
  paths: string[];
  /** Total files, including disabled ones that are only warnings about structure. */
  total: number;
  disabled?: boolean;
}

/**
 * What this export will actually write.
 *
 * The user unchecked everything except an `.ico` and still received an HTML
 * sheet and two JSON files, because those were appended at execution time with
 * no way to see or stop them. The full output list is therefore shown *before*
 * exporting — a plan cannot surprise you at the archive any more.
 */
export const OutputManifest = ({ paths, total, disabled = false }: OutputManifestProps) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[0.78rem] font-semibold text-ic-text-muted">Output</h3>
      <span className="text-[0.72rem] tabular-nums text-ic-text-faint">
        {paths.length} file{paths.length === 1 ? '' : 's'}
      </span>
    </div>

    {paths.length === 0 ? (
      <p className="rounded-xl border border-ic-danger/40 bg-ic-danger/8 px-3 py-2 text-[0.78rem] text-ic-danger">
        Nothing selected. Enable at least one artifact.
      </p>
    ) : (
      <ul className="flex max-h-64 flex-col gap-px overflow-y-auto rounded-xl border border-ic-border bg-ic-bg py-1 list-none">
        {paths.map((path) => (
          <li key={path} className="truncate px-3 py-1 text-[0.76rem] text-ic-text-muted" title={path}>
            {path}
          </li>
        ))}
      </ul>
    )}

    {total > paths.length && (
      <p className="text-[0.7rem] text-ic-text-faint">
        {total - paths.length} more file{total - paths.length === 1 ? '' : 's'} may be added at render time
        (WARNINGS.txt, only when there is something to warn about).
      </p>
    )}

    {disabled && <p className="text-[0.7rem] text-ic-text-faint">Fix the problems above to export.</p>}
  </div>
);
