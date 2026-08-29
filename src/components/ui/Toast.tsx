import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...toast, id };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      const duration = toast.durationMs ?? 6000;
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />,
  }[toast.type];

  const borderClass = {
    success: 'border-emerald-800/60 shadow-emerald-950/30',
    error: 'border-red-800/60 shadow-red-950/30',
    warning: 'border-amber-800/60 shadow-amber-950/30',
    info: 'border-indigo-800/60 shadow-indigo-950/30',
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto rounded-xl border bg-zinc-900/95 backdrop-blur-md p-3.5 shadow-2xl text-zinc-100 flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in ${borderClass}`}
      role="alert"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white tracking-tight">{toast.title}</div>
        {toast.description && (
          <div className="text-[11px] text-zinc-300 mt-1 leading-snug break-words">
            {toast.description}
          </div>
        )}
        {toast.actionLabel && toast.onAction && (
          <div className="mt-2.5">
            <button
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              {toast.actionLabel}
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
