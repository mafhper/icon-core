import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../composer/hooks/useFocusTrap';

interface StudioDialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Studio dialog shell (Fase 2): a portal over the whole viewport, focus
 * trapped inside, Escape and overlay-click dismiss.
 *
 * One shell for every studio dialog (shortcuts, new/rename, preferences,
 * export stages) so dismissal, focus and the visual frame never drift apart.
 */
export const StudioDialog = ({ title, description, onClose, initialFocusRef, children }: StudioDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, initialFocusRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="studio-dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {description && <p className="studio-dialog-description">{description}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
};
