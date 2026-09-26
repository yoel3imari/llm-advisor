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
    <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar relative z-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Model Library & Downloads</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Manage local verified GGUF weights, verify SHA-256 signatures, and monitor background downloads
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={syncing}
          className="hardware-button-tactile flex items-center gap-2 px-3.5 py-2 rounded-xl bg-obsidian-900 hover:bg-obsidian-850 text-zinc-200 text-xs font-semibold border border-white/[0.08] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-telemetry-400' : 'text-zinc-400'}`} />
          <span>Scan & Reconcile</span>
        </button>
      </div>

      {/* Reconciliation Banners */}
      {reconciliation && (
        <div className="space-y-2">
          {reconciliation.missing_records.length > 0 && (
            <div className="p-3.5 bg-laser-950/40 border border-laser-600/40 rounded-xl text-xs text-laser-300 flex items-center gap-2.5 shadow-bevel">
              <AlertCircle className="w-4 h-4 text-laser-400 shrink-0" />
              <span>
                Found {reconciliation.missing_records.length} model records missing their physical files on disk.
              </span>
            </div>
          )}
          {reconciliation.orphan_files.length > 0 && (
            <div className="p-3.5 bg-voltage-950/40 border border-voltage-600/40 rounded-xl text-xs text-voltage-300 flex items-center gap-2.5 shadow-bevel">
              <AlertCircle className="w-4 h-4 text-voltage-400 shrink-0" />
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
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <FolderDown className="w-4 h-4 text-telemetry-400" /> Active Downloads ({activeDownloads.length})
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
                    className="hardware-card bg-laser-950/30 border-laser-600/40 p-4 space-y-3 shadow-bevel"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-laser-400 shrink-0" />
                        <span className="font-semibold text-laser-200">{task.entry_id}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-laser-900/60 text-laser-300 border border-laser-700/60">
                          FAILED
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-laser-400 hover:text-laser-200 hover:bg-laser-900/40 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-xs font-mono"
                        title="Dismiss Error"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>

                    <div className="p-3 bg-obsidian-950 rounded-lg border border-laser-900/50 space-y-1">
                      <div className="text-[11px] font-semibold text-laser-400 font-mono">Error Diagnostic:</div>
                      <div className="text-xs text-laser-300 font-mono break-all whitespace-pre-wrap leading-relaxed">
                        {failReason}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={task.entry_id}
                  className="hardware-card p-4 space-y-3 shadow-bevel"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-telemetry-400 animate-pulse" />
                      <span>{task.entry_id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono tabular-nums text-telemetry-300 font-semibold">
                        {mb(task.bytes_done)} / {mb(task.bytes_total)} MB ({progressPct}%)
                      </span>
                      <button
                        onClick={() => handleCancelDownload(task.entry_id)}
                        className="text-zinc-500 hover:text-laser-400 transition-colors p-1"
                        title="Cancel Download"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden border border-white/[0.08] shadow-well p-[1px]">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-gradient-to-r from-telemetry-500 to-phosphor-400 rounded-full transition-all duration-300 shadow-glow-cyan"
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
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
          Installed Models ({records.length})
        </h3>

        {records.length === 0 ? (
          <div className="hardware-card p-12 text-center text-zinc-400 space-y-2">
            <FolderDown className="w-10 h-10 mx-auto text-zinc-600" />
            <div className="font-semibold text-zinc-200 font-sans">No models downloaded yet</div>
            <p className="text-xs max-w-sm mx-auto font-mono text-zinc-500">
              Go to Telemetry & Fit to browse compatible models and start a verified download.
            </p>
          </div>
        ) : (
          <div className="hardware-card overflow-hidden shadow-bevel">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-obsidian-950 text-zinc-400 border-b border-white/[0.08] font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 font-semibold">Model ID</th>
                    <th className="p-3.5 font-semibold">Size</th>
                    <th className="p-3.5 font-semibold">Integrity</th>
                    <th className="p-3.5 font-semibold">Added Date</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                  {records.map((rec) => (
                    <tr key={rec.entry_id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-3.5 font-semibold text-white font-mono">{rec.entry_id}</td>
                      <td className="p-3.5 font-mono tabular-nums text-zinc-200">{gb(rec.size_bytes)} GB</td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 text-phosphor-400 font-mono text-[11px] font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> SHA-256 Validated
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-400 font-mono text-[11px]">
                        {new Date(rec.added_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => onNavigateToServer(rec.entry_id)}
                          className="hardware-button-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-phosphor-950/80 hover:bg-phosphor-900/90 text-phosphor-300 font-semibold border border-phosphor-500/40 text-xs shadow-jewel-green transition-all"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Serve
                        </button>
                        <button
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1.5 text-zinc-400 hover:text-laser-400 transition-colors rounded-lg hover:bg-obsidian-850"
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
