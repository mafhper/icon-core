import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  /**
   * `true` quando o toast **nao** some sozinho.
   *
   * ## Por que existe
   *
   * Porque um toast de 4,5 s e o formato errado para um fato **permanente** da sessao.
   * O caso real: "este browser nao escreve no lugar, os arquivos sao baixados" — e isso
   * continua verdade depois de 4,5 s, e a pessoa vai descobrir de novo no proximo
   * `Ctrl+S`. O `exploracao-openpencil` resolve isso com um **banner** persistente
   * (`FileApiBanner.vue`); aqui e um toast que nao expira, porque um banner novo seria
   * uma surface nova e uma linha de CSS — e o orcamento de CSS tem 5 linhas de folga.
   *
   * O que **nao** muda: o toast continua sendo dispensavel a mao. "Persistente" aqui
   * quer dizer "nao some sem a pessoa pedir", e nao "nao pode sair".
   */
  sticky?: boolean;
}

interface ToastApi {
  toasts: Toast[];
  dismiss: (id: number) => void;
  show: (message: string, variant?: ToastVariant, options?: { sticky?: boolean }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Um aviso que **nao** expira. Ver {@link Toast.sticky}. */
  sticky: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', options: { sticky?: boolean } = {}) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, variant, message, sticky: options.sticky }]);
      // Um toast sticky nao ganha timer. E o timer que faz ele sumir, entao a ausencia
      // dele **e** o comportamento — e nao um `if` no meio do `setTimeout`.
      if (!options.sticky) {
        timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
      }
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(() => ({
    toasts,
    dismiss,
    show,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'info'),
    sticky: (message: string, variant: ToastVariant = 'info') => show(message, variant, { sticky: true })
  }), [toasts, dismiss, show]);

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- The context hook belongs to this provider module.
export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
