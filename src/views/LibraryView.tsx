import { useState } from 'react';
import { FolderDown, Trash2, CheckCircle, RefreshCw, AlertCircle, PlayCircle, XCircle } from 'lucide-react';
import type { ModelRecord, DownloadTask, LibraryReconciliation } from '../types/domain';
import { deleteLibraryModel, reconcileLibrary, cancelDownload } from '../ipc/commands';
import { DeleteConfirmDialog } from '../components/ui/DeleteConfirmDialog';

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
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Model Library & Downloads</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Manage local verified GGUF weights and monitor active downloads
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={syncing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-indigo-400' : ''}`} />
          Scan & Reconcile
        </button>
      </div>

      {/* Reconciliation Banners */}
      {reconciliation && (
        <div className="space-y-2">
          {reconciliation.missing_records.length > 0 && (
            <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                Found {reconciliation.missing_records.length} model records missing their physical files on disk.
              </span>
            </div>
          )}
          {reconciliation.orphan_files.length > 0 && (
            <div className="p-3 bg-amber-950/70 border border-amber-800/80 rounded-lg text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
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
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <FolderDown className="w-4 h-4 text-indigo-400" /> Active Downloads
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
                    className="bg-red-950/30 border border-red-800/60 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-red-200">{task.entry_id}</div>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-red-400 hover:text-red-200 transition-colors flex items-center gap-1 text-xs"
                        title="Dismiss Error"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                    <div className="text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{failReason}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={task.entry_id}
                  className="bg-zinc-900 border border-indigo-900/50 rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold text-white">{task.entry_id}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-indigo-300">
                        {mb(task.bytes_done)} / {mb(task.bytes_total)} MB ({progressPct}%)
                      </span>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-zinc-400 hover:text-red-400 transition-colors"
                        title="Cancel Download"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-300"
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
        <h3 className="text-sm font-semibold text-zinc-200">
          Installed Models ({records.length})
        </h3>

        {records.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center text-zinc-400 space-y-2">
            <FolderDown className="w-10 h-10 mx-auto text-zinc-400 opacity-60" />
            <div className="font-medium text-zinc-300">No models downloaded yet</div>
            <p className="text-xs max-w-sm mx-auto">
              Go to the Recommendations tab to browse compatible models and start a verified download.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3.5 font-semibold">Model ID</th>
                  <th className="p-3.5 font-semibold">Size</th>
                  <th className="p-3.5 font-semibold">Integrity</th>
                  <th className="p-3.5 font-semibold">Added Date</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {records.map((rec) => (
                  <tr key={rec.entry_id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-3.5 font-medium text-white">{rec.entry_id}</td>
                    <td className="p-3.5 font-mono text-zinc-300">{gb(rec.size_bytes)} GB</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> SHA256 Verified
                      </span>
                    </td>
                    <td className="p-3.5 text-zinc-400">
                      {new Date(rec.added_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => onNavigateToServer(rec.entry_id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" /> Serve
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rec)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors rounded hover:bg-zinc-800"
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
