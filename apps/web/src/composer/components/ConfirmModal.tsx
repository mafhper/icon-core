import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@iconcore/ui';
import { useFocusTrap } from '../hooks/useFocusTrap';

/**
 * A yes/no that blocks the action until it is answered.
 *
 * Exists because "New project" is destructive in a way that is not obvious: the
 * autosave fires about two seconds after the new blank project is created, and
 * overwrites the stored copy. Nothing archives it first, so the previous work is
 * simply gone — and when the open project had nothing unsaved, the usual "you have
 * unsaved changes" reasoning says there is nothing to confirm.
 *
 * Built on the same primitives as `BackgroundRemovalModal`: a portal, the
 * `ic-modal-overlay` / `ic-modal` classes, and a focus trap, so it inherits the
 * existing visual and keyboard contract instead of inventing one.
 */
export const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, true, confirmRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="ic-modal-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="ic-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ic-modal-head">
          <h2>{title}</h2>
        </div>
        <p>{message}</p>
        <div className="ic-modal-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {/* Focused by default: the answer being asked for is "yes, go ahead",
              and the destructive choice should not be the one a stray Enter
              reaches without the user having read the message. */}
          <Button ref={confirmRef} variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
