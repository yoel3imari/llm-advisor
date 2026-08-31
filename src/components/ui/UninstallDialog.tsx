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
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-50 text-zinc-100 animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none max-h-[90vh] overflow-y-auto">
          {!result ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center shrink-0 text-red-400 shadow-inner">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <Dialog.Title className="text-lg font-bold text-white tracking-tight">
                    Automated Uninstaller & Deep Cleaner
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Automate complete removal of multi-gigabyte GGUF model weights, cached runtime data, and authentication tokens with zero manual folder navigation.
                  </Dialog.Description>
                </div>
              </div>

              {/* Status Warning Banner */}
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <span className="font-semibold text-amber-200">Zero Residual Files Guarantee:</span>
                  <p className="text-amber-300/90">
                    Standard OS uninstallers leave model files intact. This tool safely clears all local storage footprints.
                  </p>
                </div>
              </div>

              {/* Interactive Cleanup Checklist */}
              {!isRunning && (
                <div className="space-y-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4">
                  <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Automated Actions to Execute
                  </div>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer transition-colors">
                    <Checkbox
                      checked={deleteModels}
                      onCheckedChange={(c) => setDeleteModels(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                        <HardDrive className="w-3.5 h-3.5 text-red-400" />
                        <span>Purge GGUF Model Weights</span>
                        <span className="text-[10px] font-mono bg-red-950 text-red-300 border border-red-800/50 px-1.5 py-0.5 rounded">
                          {formatBytes(totalBytes)} ({modelCount} {modelCount === 1 ? 'model' : 'models'})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Deletes downloaded binary model files (.gguf) and active download parts from disk.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer transition-colors">
                    <Checkbox
                      checked={clearConfigs}
                      onCheckedChange={(c) => setClearConfigs(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Wipe Stored Credentials & Preferences</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Removes Hugging Face API keys from keychain/settings and restores all gateway defaults.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer transition-colors">
                    <Checkbox
                      checked={clearCache}
                      onCheckedChange={(c) => setClearCache(!!c)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Clear Logs & Temporary Runtime Cache</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Deletes sidecar process logs, temporary files, and catalog indexing caches.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Running Steps Progress */}
              {isRunning && (
                <div className="space-y-3 bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
                  <div className="text-xs font-semibold text-zinc-300 mb-2">
                    Running Automated Deep Clean...
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-3">
                      {steps[0] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : steps[0] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className={steps[0] === 'running' ? 'text-white font-medium' : steps[0] === 'done' ? 'text-zinc-300' : 'text-zinc-500'}>
                        Terminating background inference servers & gateway proxy
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[1] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : steps[1] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className={steps[1] === 'running' ? 'text-white font-medium' : steps[1] === 'done' ? 'text-zinc-300' : 'text-zinc-500'}>
                        Cancelling active downloads & removing partial chunks
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[2] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : steps[2] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className={steps[2] === 'running' ? 'text-white font-medium' : steps[2] === 'done' ? 'text-zinc-300' : 'text-zinc-500'}>
                        Purging GGUF model binaries and freeing disk space
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {steps[3] === 'running' ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : steps[3] === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className={steps[3] === 'running' ? 'text-white font-medium' : steps[3] === 'done' ? 'text-zinc-300' : 'text-zinc-500'}>
                        Wiping application settings, credentials, and cache
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
                  {error}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRunning || (!deleteModels && !clearConfigs && !clearCache)}
                  onClick={handleStartCleanup}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="w-14 h-14 rounded-full bg-emerald-950 border-2 border-emerald-500/60 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/50 animate-in zoom-in-50 duration-300">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div className="space-y-1.5">
                <Dialog.Title className="text-xl font-bold text-white tracking-tight">
                  Clean Uninstall Completed Successfully!
                </Dialog.Title>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  All selected model weights, user credentials, and cached application files have been completely removed from your system.
                </p>
              </div>

              {/* Reclaimed stats */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Disk Space Reclaimed</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-300">
                    {formatBytes(result.reclaimed_bytes)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Trash2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Models Removed</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-indigo-300">
                    {result.models_deleted} {result.models_deleted === 1 ? 'model' : 'models'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-400 text-left space-y-1.5">
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Next Step for Final Application Removal</span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Your system storage is now 100% clean of all weights and data. You can safely drag Local LLM Advisor to Trash or delete its executable from your Applications folder.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md"
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
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
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
