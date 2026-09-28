import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Trash2, X, Loader2, HardDrive } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  sizeBytes?: number;
  isServing?: boolean;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  confirmButtonText?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 MB';
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  modelId,
  sizeBytes,
  isServing = false,
  onConfirm,
  title = 'Delete Model Weights',
  description = 'Are you sure you want to delete this model from your local disk? This action will reclaim storage space and cannot be undone.',
  confirmButtonText = 'Delete Model',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to confirm deletion', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-corporate-hover z-50 text-slate-900 dark:text-slate-100 animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <Dialog.Title className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </Dialog.Description>

              {/* Model identifier card */}
              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {modelId}
                </div>
                {sizeBytes !== undefined && sizeBytes > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Reclaims {formatBytes(sizeBytes)} of disk space</span>
                  </div>
                )}
              </div>

              {/* Warning if actively serving */}
              {isServing && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>This model is currently running. Deleting it will automatically stop the inference server.</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-sm hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmButtonText}</span>
                </>
              )}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
