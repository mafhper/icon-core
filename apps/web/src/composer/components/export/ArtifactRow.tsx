import { useState } from 'react';
import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ExportArtifact, ExportContainerSpec, IconVariant } from '@iconcore/shared';
import { isContainerSpec, kindOf } from '@iconcore/shared';
import { Button, NumberField, Select, Slider } from '@iconcore/ui';
import { CONTAINER_ENTRY_CHOICES, EXPORT_VARIANT_CHOICES, formatLabel } from '../../utils/exportPlanState';

export interface ArtifactRowProps {
  artifact: ExportArtifact;
  onChange: (id: string, patch: Partial<ExportArtifact>) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleEntry: (id: string, entry: number) => void;
}

/**
 * One artifact in the export plan (spec §7).
 *
 * Editing is **contextual by nature** (spec §2.2): a container edits its entry
 * ladder, a raster its size/quality, a vector its canvas size. A container never
 * shows an isolated width/height, because it has no single size.
 */
export const ArtifactRow = ({
  artifact,
  onChange,
  onToggle,
  onDuplicate,
  onRemove,
  onToggleEntry
}: ArtifactRowProps) => {
  const [editing, setEditing] = useState(false);
  const kind = kindOf(artifact.format);
  const container = isContainerSpec(artifact) ? (artifact as ExportContainerSpec) : null;
  const isLossy = artifact.format === 'webp' || artifact.format === 'jpeg';

  return (
    <li
      className="rounded-xl border border-ic-border bg-ic-bg transition-[border-color,opacity] duration-150 data-[enabled=false]:opacity-50"
      data-enabled={artifact.enabled}
    >
      {/* minmax(0,1fr) so a long path truncates instead of stretching the row
          (the IC4 lesson: grids sized by min-content overflow their panel). */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={artifact.enabled}
            onChange={() => onToggle(artifact.id)}
            aria-label={`Include ${artifact.path}`}
          />
        </label>

        <button
          type="button"
          className="flex min-w-0 cursor-pointer flex-col items-start gap-0.5 border-0 bg-transparent text-left"
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
        >
          <span className="max-w-full truncate text-[0.82rem] text-ic-text">{artifact.path}</span>
          <span className="flex items-center gap-1.5 text-[0.72rem] text-ic-text-muted">
            <span className="ic-plan-badge rounded-md bg-ic-elevated px-1.5 py-px text-[0.66rem] font-semibold text-ic-text-muted" data-kind={kind}>
              {formatLabel(artifact.format)}
            </span>
            {container
              ? `${container.entries.length} sizes`
              : `${artifact.size ?? 512}px`}
            {artifact.variant ? ` · ${artifact.variant}` : ''}
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            iconLeft={editing ? <X size={14} /> : <Pencil size={14} />}
            onClick={() => setEditing((value) => !value)}
            aria-label={editing ? `Stop editing ${artifact.path}` : `Edit ${artifact.path}`}
          />
          <Button
            variant="ghost"
            iconLeft={<Copy size={14} />}
            onClick={() => onDuplicate(artifact.id)}
            aria-label={`Duplicate ${artifact.path}`}
          />
          <Button
            variant="ghost"
            iconLeft={<Trash2 size={14} />}
            onClick={() => onRemove(artifact.id)}
            aria-label={`Remove ${artifact.path}`}
          />
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-2.5 border-t border-ic-border px-3 pb-3 pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] text-ic-text-muted">Output path</span>
            <input
              type="text"
              className="rounded-lg border border-ic-border bg-ic-bg px-2 py-1.5 text-[0.82rem] text-ic-text"
              value={artifact.path}
              onChange={(event) => onChange(artifact.id, { path: event.target.value })}
              aria-label={`Output path for ${artifact.format}`}
            />
          </label>

          {container ? (
            <fieldset className="flex flex-col gap-1.5 border-0 p-0">
              <legend className="pb-1.5 text-[0.72rem] text-ic-text-muted">Embedded sizes</legend>
              <div className="flex flex-wrap gap-1">
                {CONTAINER_ENTRY_CHOICES.map((entry) => {
                  const on = container.entries.includes(entry);
                  return (
                    <button
                      key={entry}
                      type="button"
                      className="inline-flex min-h-[26px] cursor-pointer items-center gap-0.5 rounded-lg border border-ic-border bg-transparent px-2 text-[0.72rem] tabular-nums text-ic-text-muted transition-[background-color,border-color,color] duration-150 data-[on=true]:border-ic-accent data-[on=true]:bg-ic-accent/15 data-[on=true]:text-ic-accent-text"
                      data-on={on}
                      aria-pressed={on}
                      onClick={() => onToggleEntry(artifact.id, entry)}
                    >
                      {on ? <Check size={12} /> : <Plus size={12} />}
                      {entry}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <NumberField
              label={artifact.format === 'svg' ? 'Canvas size' : 'Size'}
              min="1"
              max="4096"
              value={artifact.size ?? 512}
              onChange={(event) => onChange(artifact.id, { size: Number(event.target.value) })}
            />
          )}

          {isLossy && (
            <Slider
              variant="inline"
              label="Quality"
              unit="%"
              min="10"
              max="100"
              value={Math.round((artifact.quality ?? 0.92) * 100)}
              onChange={(event) => onChange(artifact.id, { quality: Number(event.target.value) / 100 })}
            />
          )}

          <Select
            label="Variant"
            value={artifact.variant ?? ''}
            onChange={(event) =>
              onChange(artifact.id, {
                variant: (event.target.value || undefined) as IconVariant | undefined
              })
            }
          >
            <option value="">All selected variants</option>
            {EXPORT_VARIANT_CHOICES.map((variant) => (
              <option key={variant} value={variant}>{variant}</option>
            ))}
          </Select>
        </div>
      )}
    </li>
  );
};

export interface AddArtifactRowProps {
  onAdd: (format: ExportArtifact['format']) => void;
}

const ADDABLE_FORMATS: ExportArtifact['format'][] = ['png', 'webp', 'jpeg', 'svg', 'ico', 'icns'];

/** "Add artifact" affordance: pick the nature, the row brings sensible entries. */
export const AddArtifactRow = ({ onAdd }: AddArtifactRowProps) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" iconLeft={<Plus size={14} />} onClick={() => setOpen(true)}>
        Add artifact
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ADDABLE_FORMATS.map((format) => (
        <Button key={format} variant="secondary" onClick={() => { onAdd(format); setOpen(false); }}>
          {formatLabel(format)}
        </Button>
      ))}
      <Button variant="ghost" iconLeft={<X size={14} />} onClick={() => setOpen(false)} aria-label="Cancel adding an artifact" />
    </div>
  );
};
