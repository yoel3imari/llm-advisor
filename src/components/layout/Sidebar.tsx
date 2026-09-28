import { useState } from 'react';
import { Cpu, FolderDown, MessageSquare, PlayCircle, Settings, X, Terminal, Check, Copy } from 'lucide-react';
import type { DownloadTask, ServerState } from '../../types/domain';
import { ServerStatusPill } from './ServerStatusPill';

export type NavTab = 'chat' | 'dashboard' | 'library' | 'server' | 'settings';

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
  const [copiedPort, setCopiedPort] = useState(false);

  const navItems = [
    { id: 'chat' as NavTab, label: 'Chat', icon: MessageSquare, badge: null },
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: Cpu, badge: null },
    { id: 'library' as NavTab, label: 'Library', icon: FolderDown, badge: activeDownloads.length > 0 ? `${activeDownloads.length}` : null },
    { id: 'server' as NavTab, label: 'Server Control', icon: PlayCircle, badge: serverState.state === 'serving' ? 'ON' : null },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings, badge: null },
  ];

  const handleCopyEndpoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('http://127.0.0.1:13370/v1');
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  };

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 select-none relative z-20 shadow-sm transition-colors">
      <div className="space-y-6">
        {/* Hardware Header / Brand Lockup */}
        <div className="flex items-center gap-3 px-1.5 py-1">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 dark:from-slate-800 dark:to-slate-850 border border-indigo-100 dark:border-slate-700 shadow-corporate flex items-center justify-center p-1.5 shrink-0 overflow-hidden group">
            <img src="/app-icon.png" alt="LLM Advisor" className="w-full h-full object-contain filter drop-shadow" />
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/10 via-violet-600/10 to-transparent pointer-events-none" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none font-sans">
                LLM Advisor
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono tracking-tight flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.6)] inline-block animate-pulse"></span>
              HARDWARE INFERENCE
            </p>
          </div>
        </div>

        {/* Navigation Rail */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs tracking-wide transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/60 dark:text-white shadow-sm border border-indigo-100 dark:border-indigo-900/50 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-gradient-to-b from-indigo-600 to-violet-600 shadow-corporate-btn" />
                )}

                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      item.badge === 'ON'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800/60 animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Dock */}
      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        {/* Active Downloads List in Sidebar Bottom */}
        {activeDownloads.length > 0 && (
          <div className="space-y-2">
            <div
              onClick={() => onSelectTab('library')}
              className="flex items-center justify-between px-1 cursor-pointer group"
              title="Click to open Library"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <FolderDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                <span>Active Downloads</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                {activeDownloads.length}
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
              {activeDownloads.map((task) => {
                const isFailed = task.state.status === 'failed' || !!task.error;
                const progressPct =
                  task.bytes_total > 0
                    ? Math.round((task.bytes_done / task.bytes_total) * 100)
                    : 0;

                if (isFailed) {
                  return (
                    <div
                      key={task.entry_id}
                      onClick={() => onSelectTab('library')}
                      className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:border-rose-400 transition-all space-y-1 text-xs cursor-pointer group shadow-sm"
                      title="Click to view full error in Library"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-medium text-rose-700 dark:text-rose-200 truncate text-[11px]"
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
                            className="p-0.5 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0"
                            title="Dismiss error"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-300 flex items-center justify-between">
                        <span>Download failed</span>
                        <span className="text-[9px] text-rose-500 group-hover:underline">
                          Inspect →
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.entry_id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all space-y-1.5 text-xs shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => onSelectTab('library')}
                        className="font-medium text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-[11px]"
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
                          className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                          title="Cancel download"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progressPct}%</span>
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

        {/* Local Gateway Port Dock */}
        <div
          onClick={handleCopyEndpoint}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600 transition-all cursor-pointer group shadow-sm"
          title="Click to copy local OpenAI endpoint (127.0.0.1:13370/v1)"
        >
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors font-semibold">
            <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="tabular-nums">:13370/v1</span>
          </div>
          <div className="flex items-center gap-1.5">
            {copiedPort ? (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Copied
              </span>
            ) : (
              <Copy className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" />
            )}
          </div>
        </div>

        {/* Server Status Pill */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Daemon</span>
          <ServerStatusPill state={serverState} />
        </div>
      </div>
    </aside>
  );
}
