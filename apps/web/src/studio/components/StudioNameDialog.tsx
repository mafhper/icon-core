import { useState } from 'react';
import { Button, Select, TextField } from '@iconcore/ui';
import { StudioDialog } from './StudioDialog';

interface StudioNameDialogProps {
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  /** Shown only for new documents: the canvas is square, this is its side. */
  sizes?: number[];
  initialSize?: number;
  onSubmit: (name: string, size?: number) => void;
  onClose: () => void;
}

/**
 * Studio name form (Fase 5): rename-document and new-document share one
 * honest form — a name field (blank never submits) plus, for new documents,
 * the canvas size. No separate dialogs that drift apart.
 */
export const StudioNameDialog = ({
  title,
  description,
  initialName,
  submitLabel,
  sizes,
  initialSize,
  onSubmit,
  onClose
}: StudioNameDialogProps) => {
  const [name, setName] = useState(initialName);
  const [size, setSize] = useState<number>(initialSize ?? sizes?.[1] ?? 512);
  const valid = name.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit(name.trim(), sizes ? size : undefined);
  };

  return (
    <StudioDialog title={title} description={description} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        {sizes && (
          <Select label="Canvas size" value={String(size)} onChange={(event) => setSize(Number(event.target.value))}>
            {sizes.map((option) => (
              <option key={option} value={option}>
                {option} × {option} px
              </option>
            ))}
          </Select>
        )}
        <div className="studio-dialog-actions mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </StudioDialog>
  );
};
