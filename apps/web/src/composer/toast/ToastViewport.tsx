import { TriangleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToast, type ToastVariant } from './ToastContext';

const icons: Record<ToastVariant, typeof Info> = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info
};

export const ToastViewport = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="ic-toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];
        return (
          <div key={toast.id} className={`ic-toast ic-toast-${toast.variant}`} role="status">
            <Icon size={16} className="ic-toast-icon" aria-hidden="true" />
            <span className="ic-toast-message">{toast.message}</span>
            <button
              type="button"
              className="ic-toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
