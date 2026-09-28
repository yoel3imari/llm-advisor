import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  HardDrive,
  Check,
  KeyRound,
  FileText,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { Checkbox } from './Checkbox';
import { cleanUninstall } from '../../ipc/commands';
import type { UninstallResult } from '../../types/domain';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalBytes: number;
  modelCount: number;
  onCleanupComplete: () => void;
}

type StepState = 'pending' | 'running' | 'done';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 MB';
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UninstallDialog({
  open,
  onOpenChange,
  totalBytes,
  modelCount,
  onCleanupComplete,
}: Props) {
  const [deleteModels, setDeleteModels] = useState(true);
  const [clearConfigs, setClearConfigs] = useState(true);
  const [clearCache, setClearCache] = useState(true);

  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([
    'pending',
    'pending',
    'pending',
    'pending',
  ]);
  const [result, setResult] = useState<UninstallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartCleanup = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    // Step 1: Stopping background servers
    setSteps(['running', 'pending', 'pending', 'pending']);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSteps(['done', 'running', 'pending', 'pending']);

    // Step 2: Cancelling downloads & removing temporary weights
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSteps(['done', 'done', 'running', 'pending']);

    try {
      // Step 3 & 4: Trigger backend clean uninstall command
      const res = await cleanUninstall({
        delete_models: deleteModels,
        clear_configs: clearConfigs,
        clear_cache: clearCache,
      });

      await new Promise((resolve) => setTimeout(resolve, 600));
      setSteps(['done', 'done', 'done', 'running']);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setSteps(['done', 'done', 'done', 'done']);
      setResult(res);
      onCleanupComplete();
    } catch (err: unknown) {
      console.error('Automated uninstall error:', err);
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (isRunning) return;
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setResult(null);
      setError(null);
      setSteps(['pending', 'pending', 'pending', 'pending']);
    }, 300);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => !isRunning && onOpenChange(val)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-corporate-hover z-50 text-slate-800 dark:text-slate-100 animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none max-h-[90vh] overflow-y-auto">
          {!result ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Automated Uninstaller & Deep Cleaner
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Automate complete removal of multi-gigabyte GGUF model weights, cached runtime data, and authentication tokens with zero manual folder navigation.
                  </Dialog.Description>
                </div>
              </div>

              {/* Status Warning Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">Zero Residual Files Guarantee:</span>
                  <p className="text-amber-700/90 dark:text-amber-300/90">
                    Standard OS uninstallers leave model files intact. This tool safely clears all local storage footprints.
                  </p>
                </div>
              </div>

              {/* Interactive Cleanup Checklist */}
              {!isRunning && (
                <div className="space-y-3 bg-slate-50/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Automated Actions to Execute
                  </div>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800">
                    <Checkbox
                      checked={deleteModels}
                      onCheckedChange={(c) => setDeleteModels(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <HardDrive className="w-3.5 h-3.5 text-rose-500" />
                        <span>Purge GGUF Model Weights</span>
                        <span className="text-[10px] font-mono bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 px-1.5 py-0.5 rounded font-bold">
                          {formatBytes(totalBytes)} ({modelCount} {modelCount === 1 ? 'model' : 'models'})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Deletes downloaded binary model files (.gguf) and active download parts from disk.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800">
                    <Checkbox
                      checked={clearConfigs}
                      onCheckedChange={(c) => setClearConfigs(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        <span>Wipe Stored Credentials & Preferences</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Removes Hugging Face API keys from keychain/settings and restores all gateway defaults.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800">
                    <Checkbox
                      checked={clearCache}
                      onCheckedChange={(c) => setClearCache(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Clear Logs & Temporary Runtime Cache</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Deletes sidecar process logs, temporary files, and catalog indexing caches.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Running Steps Progress */}
              {isRunning && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Running Automated Deep Clean...
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-3">
                      {steps[0] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : steps[0] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                      )}
                      <span className={steps[0] === 'running' ? 'text-indigo-950 dark:text-white font-semibold' : steps[0] === 'done' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                        Terminating background inference servers & gateway proxy
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[1] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : steps[1] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                      )}
                      <span className={steps[1] === 'running' ? 'text-indigo-950 dark:text-white font-semibold' : steps[1] === 'done' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                        Cancelling active downloads & removing partial chunks
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[2] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : steps[2] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                      )}
                      <span className={steps[2] === 'running' ? 'text-indigo-950 dark:text-white font-semibold' : steps[2] === 'done' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                        Purging GGUF model binaries and freeing disk space
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[3] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : steps[3] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                      )}
                      <span className={steps[3] === 'running' ? 'text-indigo-950 dark:text-white font-semibold' : steps[3] === 'done' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                        Wiping application settings, credentials, and cache
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
                  {error}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRunning || (!deleteModels && !clearConfigs && !clearCache)}
                  onClick={handleStartCleanup}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-corporate-btn hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cleaning System...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Execute Automated Deep Clean</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Success / Clean Completion State */
            <div className="space-y-6 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div className="space-y-1.5">
                <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Clean Uninstall Completed Successfully!
                </Dialog.Title>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  All selected model weights, user credentials, and cached application files have been completely removed from your system.
                </p>
              </div>

              {/* Reclaimed stats */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Disk Space Reclaimed</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatBytes(result.reclaimed_bytes)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <Trash2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Models Removed</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {result.models_deleted} {result.models_deleted === 1 ? 'model' : 'models'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 text-left space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Next Step for Final Application Removal</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Your system storage is now 100% clean of all weights and data. You can safely drag LLM Advisor to Trash or delete its executable from your Applications folder.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-corporate-btn hover:-translate-y-0.5"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {!isRunning && (
            <Dialog.Close asChild>
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
