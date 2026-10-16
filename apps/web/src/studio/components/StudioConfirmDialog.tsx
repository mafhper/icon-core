import { useRef } from 'react';
import { Button } from '@iconcore/ui';
import { StudioDialog } from './StudioDialog';

interface StudioConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Studio yes/no (Fase 2): blocks the action until answered.
 *
 * Menu-driven deletes go through here — keyboard Delete stays direct because
 * it is undoable in one keystroke, but a menu click is deliberate enough to
 * deserve the question. New-document (Fase 5) will reuse this: the autosave
 * overwrites the stored copy, so there is nothing to undo back to.
 *
 * Like the Composer's `ConfirmModal`, the confirm button is primary (never a
 * danger fill: `--ic-danger` only clears the text ratios) and takes initial
 * focus — the answer being asked for is "yes, go ahead".
 */
export const StudioConfirmDialog = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: StudioConfirmDialogProps) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  return (
    <StudioDialog title={title} onClose={onCancel} initialFocusRef={confirmRef}>
      <p className="studio-dialog-description">{message}</p>
      <div className="studio-dialog-actions">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button ref={confirmRef} variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </StudioDialog>
  );
};
