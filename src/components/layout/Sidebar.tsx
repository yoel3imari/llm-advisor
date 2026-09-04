import { Cpu, FolderDown, PlayCircle, Settings, X } from 'lucide-react';
import type { DownloadTask, ServerState } from '../../types/domain';
import { ServerStatusPill } from './ServerStatusPill';

export type NavTab = 'dashboard' | 'library' | 'server' | 'settings';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  serverState: ServerState;
  activeDownloads?: DownloadTask[];
  onCancelDownload?: (entryId: string) => void;
}

function formatDownloadSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  serverState,
  activeDownloads = [],
  onCancelDownload,
}: Props) {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: Cpu },
    { id: 'library' as NavTab, label: 'Library', icon: FolderDown },
    { id: 'server' as NavTab, label: 'Server Control', icon: PlayCircle },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between p-4 select-none">
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-12 h-12 rounded-xl border border-0 flex items-center justify-center p-1 shrink-0">
            <img src="/app-icon.png" alt="LLM Advisor" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-none">LLM Advisor</h1>
            <p className="text-[11px] text-zinc-400 mt-1">Hardware Fit & Inference</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLibraryTab = item.id === 'library';
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                  {item.label}
                </div>
                {isLibraryTab && activeDownloads.length > 0 && (
                  <span className="flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 animate-pulse">
                    {activeDownloads.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-3 ">
        {/* Active Downloads List in Sidebar Bottom */}
        {activeDownloads.length > 0 && (
          <div className="space-y-2">
            <div
              onClick={() => onSelectTab('library')}
              className="flex items-center justify-between px-1 cursor-pointer group"
              title="Click to open Library"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">
                {/* <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" /> */}
                <span>Active Downloads</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {activeDownloads.length}
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 pr-0.5">
              {activeDownloads.map((task) => {
                const isFailed =
                  task.state.status === 'failed' || !!task.error;
                const progressPct =
                  task.bytes_total > 0
                    ? Math.round((task.bytes_done / task.bytes_total) * 100)
                    : 0;

                if (isFailed) {
                  return (
                    <div
                      key={task.entry_id}
                      onClick={() => onSelectTab('library')}
                      className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/80 hover:border-red-700/80 transition-all space-y-1 text-xs cursor-pointer group"
                      title="Click to view full error in Library"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-medium text-red-200 truncate text-[11px]"
                          title={task.entry_id}
                        >
                          {task.entry_id}
                        </span>
                        {onCancelDownload && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelDownload(task.entry_id);
                            }}
                            className="p-0.5 rounded text-red-400 hover:text-red-200 hover:bg-red-900/50 transition-colors shrink-0"
                            title="Dismiss error"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-red-300 flex items-center justify-between">
                        <span>Download failed</span>
                        <span className="text-[9px] text-red-400/70 font-normal group-hover:underline">
                          View in Library →
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.entry_id}
                    className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-800/70 transition-all space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => onSelectTab('library')}
                        className="font-medium text-zinc-200 truncate cursor-pointer hover:text-indigo-300 transition-colors text-[11px]"
                        title={task.entry_id}
                      >
                        {task.entry_id}
                      </span>
                      {onCancelDownload && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelDownload(task.entry_id);
                          }}
                          className="p-0.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors shrink-0"
                          title="Cancel download"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="text-indigo-300 font-semibold">{progressPct}%</span>
                      <span>
                        {formatDownloadSize(task.bytes_done)} / {formatDownloadSize(task.bytes_total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1 pt-1 border-t border-zinc-800/50">
          <span className="text-xs font-medium text-zinc-400">Gateway Status</span>
          <ServerStatusPill state={serverState} />
        </div>
          <div>
            <span className="text-xs text-lime-700">@yoel3imari</span>
          </div>
      </div>
    </aside>
  );
}
