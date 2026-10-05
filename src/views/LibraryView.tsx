import { useState } from 'react';
import { FolderDown, Trash2, CheckCircle, RefreshCw, AlertCircle, PlayCircle, XCircle, Copy } from 'lucide-react';
import type { ModelRecord, DownloadTask, LibraryReconciliation } from '../types/domain';
import { deleteLibraryModel, reconcileLibrary, cancelDownload } from '../ipc/commands';
import { DeleteConfirmDialog } from '../components/ui/DeleteConfirmDialog';
import { useToast } from '../components/ui/Toast';

interface Props {
  records: ModelRecord[];
  activeDownloads: DownloadTask[];
  onRefreshLibrary: () => void;
  onNavigateToServer: (modelId: string) => void;
}

export function LibraryView({
  records,
  activeDownloads,
  onRefreshLibrary,
  onNavigateToServer,
}: Props) {
  const [reconciliation, setReconciliation] = useState<LibraryReconciliation | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModelRecord | null>(null);
  const { showToast } = useToast();

  const handleCopyModelId = async (entryId: string) => {
    try {
      await navigator.clipboard.writeText(entryId);
      showToast({
        type: 'success',
        title: 'Model ID Copied',
        description: entryId,
      });
    } catch (err) {
      console.error('Failed to copy model ID to clipboard', err);
      showToast({
        type: 'error',
        title: 'Copy Failed',
        description: 'Could not copy the model ID to the clipboard.',
      });
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteLibraryModel(entryId);
      onRefreshLibrary();
    } catch (err) {
      console.error('Failed to delete model', err);
    }
  };

  const handleCancelDownload = async (entryId: string) => {
    try {
      await cancelDownload(entryId);
      onRefreshLibrary();
    } catch (err) {
      console.error('Failed to cancel download', err);
    }
  };

  const handleReconcile = async () => {
    try {
      setSyncing(true);
      const res = await reconcileLibrary();
      setReconciliation(res);
      onRefreshLibrary();
    } catch (err) {
      console.error('Failed to reconcile library', err);
    } finally {
      setSyncing(false);
    }
  };

  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-6 custom-scrollbar relative z-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="brand-gradient-text">Model Library & Downloads</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Manage local verified GGUF weights, verify SHA-256 signatures, and monitor background downloads
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={syncing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Scan & Reconcile</span>
        </button>
      </div>

      {/* Reconciliation Banners */}
      {reconciliation && (
        <div className="space-y-2">
          {reconciliation.missing_records.length > 0 && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                Found {reconciliation.missing_records.length} model records missing their physical files on disk.
              </span>
            </div>
          )}
          {reconciliation.orphan_files.length > 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Found {reconciliation.orphan_files.length} untracked files in models directory.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Active Downloads Section */}
      {activeDownloads.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <FolderDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Active Downloads ({activeDownloads.length})
          </h3>
          <div className="space-y-3">
            {activeDownloads.map((task) => {
              const isFailed = task.state.status === 'failed' || !!task.error;
              const failReason =
                task.state.status === 'failed'
                  ? task.state.reason
                  : task.error || 'Download failed';
              const progressPct = task.bytes_total > 0
                ? Math.round((task.bytes_done / task.bytes_total) * 100)
                : 0;

              if (isFailed) {
                return (
                  <div
                    key={task.entry_id}
                    className="corporate-card bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 p-4 space-y-3 shadow-corporate"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span className="font-semibold text-rose-800 dark:text-rose-200">{task.entry_id}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/60">
                          FAILED
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 text-xs font-mono font-semibold"
                        title="Dismiss Error"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-rose-200/80 dark:border-rose-900/50 space-y-1">
                      <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 font-mono">Error Diagnostic:</div>
                      <div className="text-xs text-rose-700 dark:text-rose-300 font-mono break-all whitespace-pre-wrap leading-relaxed">
                        {failReason}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={task.entry_id}
                  className="corporate-card p-4 space-y-3 shadow-corporate hover:shadow-corporate-hover hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      <span>{task.entry_id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-bold">
                        {mb(task.bytes_done)} / {mb(task.bytes_total)} MB ({progressPct}%)
                      </span>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Cancel Download"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 p-[1px] shadow-inner">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300 shadow-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Downloaded Models Library */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Installed Models ({records.length})
        </h3>

        {records.length === 0 ? (
          <div className="corporate-card p-12 text-center text-slate-400 space-y-2 shadow-corporate">
            <FolderDown className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <div className="font-bold text-slate-800 dark:text-slate-200 font-sans">No models downloaded yet</div>
            <p className="text-xs max-w-sm mx-auto font-mono text-slate-500">
              Go to Dashboard & Recommendations to browse compatible models and start a verified download.
            </p>
          </div>
        ) : (
          <div className="corporate-card overflow-hidden shadow-corporate">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 font-bold">Model ID</th>
                    <th className="p-3.5 font-bold">Size</th>
                    <th className="p-3.5 font-bold">Integrity</th>
                    <th className="p-3.5 font-bold">Added Date</th>
                    <th className="p-3.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                  {records.map((rec) => (
                    <tr key={rec.entry_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white font-mono">{rec.entry_id}</td>
                      <td className="p-3.5 font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">{gb(rec.size_bytes)} GB</td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> SHA-256 Validated
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(rec.added_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => onNavigateToServer(rec.entry_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-corporate-btn hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Serve
                        </button>
                        <button
                          onClick={() => handleCopyModelId(rec.entry_id)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-corporate-btn hover:-translate-y-0.5 active:translate-y-0 transition-all"
                          title="Copy model ID"
                          aria-label={`Copy model ID ${rec.entry_id}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Model"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          modelId={deleteTarget.entry_id}
          sizeBytes={deleteTarget.size_bytes}
          onConfirm={async () => {
            await handleDelete(deleteTarget.entry_id);
          }}
        />
      )}
    </div>
  );
}
