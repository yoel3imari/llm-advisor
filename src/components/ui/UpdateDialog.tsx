import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDownToLine,
  X,
  Loader2,
  AlertTriangle,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { installAppUpdate } from '../../ipc/commands';
import type { AppUpdateInfo } from '../../types/domain';

export interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: AppUpdateInfo | null;
  onDismiss?: () => void;
  onUpdateAndRestart?: () => Promise<void> | void;
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  onDismiss,
  onUpdateAndRestart,
}: UpdateDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!updateInfo) return null;

  const handleUpdateAndRestart = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      if (onUpdateAndRestart) {
        await onUpdateAndRestart();
      } else {
        await installAppUpdate();
      }
      setIsUpdating(false);
      setSuccess(true);
    } catch (err: unknown) {
      setError(String(err));
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    if (isUpdating || success) return;
    onOpenChange(false);
    onDismiss?.();
  };

  const formattedDate = formatDate(updateInfo.pub_date);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(val) => {
        if (!isUpdating && !success) {
          onOpenChange(val);
          if (!val) onDismiss?.();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content
          onEscapeKeyDown={(e) => {
            if (isUpdating || success) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isUpdating || success) e.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-corporate-hover z-50 text-slate-900 dark:text-slate-100 animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/80 border border-violet-200 dark:border-violet-800/80 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <Dialog.Title className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>New Version Available</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/60">
                    Update
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  A new version of LLM Advisor is available. Update now to access performance improvements and the latest features.
                </Dialog.Description>
              </div>
            </div>

            <button
              type="button"
              disabled={isUpdating || success}
              onClick={handleDismiss}
              aria-label="Close dialog"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="mt-5 space-y-4">
            {/* Version comparison card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                      Current
                    </span>
                    <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                      v{updateInfo.current_version}
                    </span>
                  </div>
                  <div className="text-slate-300 dark:text-slate-700 text-sm font-bold">
                    →
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-violet-600 dark:text-violet-400 block tracking-wider">
                      Latest
                    </span>
                    <span className="font-mono text-xs font-bold text-violet-700 dark:text-violet-300">
                      v{updateInfo.latest_version}
                    </span>
                  </div>
                </div>

                {formattedDate && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Release notes if available */}
            {updateInfo.release_notes && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Release Notes
                </span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed select-text">
                  {updateInfo.release_notes}
                </div>
              </div>
            )}

            {/* Error Notice */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in-0 duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="flex-1 break-words">Update failed: {error}</span>
              </div>
            )}

            {/* Success Notice */}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in-0 duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Update installed! Restarting application to apply changes...</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleDismiss}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={isUpdating || success}
              onClick={handleUpdateAndRestart}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-corporate-btn transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating & Restarting...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Restarting...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Update & Restart</span>
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
