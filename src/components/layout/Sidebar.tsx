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
    <aside className="w-64 bg-obsidian-950 border-r border-white/[0.07] flex flex-col justify-between p-4 select-none relative z-20">
      <div className="space-y-6">
        {/* Hardware Header / Brand Lockup */}
        <div className="flex items-center gap-3 px-1.5 py-1">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-b from-obsidian-800 to-obsidian-900 border border-white/[0.12] shadow-bevel flex items-center justify-center p-1 shrink-0 overflow-hidden group">
            <img src="/app-icon.png" alt="LLM Advisor" className="w-full h-full object-contain filter drop-shadow" />
            <div className="absolute inset-0 bg-gradient-to-tr from-blaze-500/20 via-violet-500/20 to-transparent pointer-events-none" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-sm tracking-tight text-white leading-none font-sans">
                LLM Advisor
              </h1>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1 font-mono tracking-tight flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blaze-500 shadow-[0_0_8px_#FD5900] inline-block animate-pulse"></span>
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
                className={`w-full relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 group ${
                  isActive
                    ? 'bg-obsidian-850 text-white shadow-bevel border border-white/[0.1]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-blaze-500 to-violet-600 shadow-glow-orange" />
                )}

                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? 'text-blaze-400'
                        : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.badge === 'ON'
                        ? 'bg-phosphor-950/80 text-phosphor-400 border border-phosphor-500/40 shadow-jewel-green'
                        : 'bg-telemetry-950/80 text-telemetry-400 border border-telemetry-500/40 animate-pulse'
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
      <div className="space-y-3 pt-3 border-t border-white/[0.06]">
        {/* Active Downloads List in Sidebar Bottom */}
        {activeDownloads.length > 0 && (
          <div className="space-y-2">
            <div
              onClick={() => onSelectTab('library')}
              className="flex items-center justify-between px-1 cursor-pointer group"
              title="Click to open Library"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 group-hover:text-telemetry-300 transition-colors">
                <FolderDown className="w-3.5 h-3.5 text-telemetry-400 animate-bounce" />
                <span>Active Downloads</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-telemetry-950 text-telemetry-300 border border-telemetry-800">
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
                      className="p-2.5 rounded-lg bg-laser-950/40 border border-laser-600/40 hover:border-laser-500/70 transition-all space-y-1 text-xs cursor-pointer group"
                      title="Click to view full error in Library"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-medium text-laser-200 truncate text-[11px]"
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
                            className="p-0.5 rounded text-laser-400 hover:text-laser-200 hover:bg-laser-900/50 transition-colors shrink-0"
                            title="Dismiss error"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-laser-300 flex items-center justify-between">
                        <span>Download failed</span>
                        <span className="text-[9px] text-laser-400/80 group-hover:underline">
                          Inspect →
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.entry_id}
                    className="p-2.5 rounded-xl bg-obsidian-900/90 border border-white/[0.08] hover:border-telemetry-500/40 transition-all space-y-1.5 text-xs shadow-bevel"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => onSelectTab('library')}
                        className="font-medium text-zinc-200 truncate cursor-pointer hover:text-telemetry-300 transition-colors text-[11px]"
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
                          className="p-0.5 rounded text-zinc-400 hover:text-laser-400 hover:bg-obsidian-800 transition-colors shrink-0"
                          title="Cancel download"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="w-full h-1.5 bg-obsidian-950 rounded-full overflow-hidden border border-white/[0.05]">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-gradient-to-r from-blaze-500 to-violet-500 rounded-full transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
                      <span className="text-telemetry-300 font-semibold">{progressPct}%</span>
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
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-obsidian-900 border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer group"
          title="Click to copy local OpenAI endpoint (127.0.0.1:13370/v1)"
        >
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors">
            <Terminal className="w-3.5 h-3.5 text-telemetry-400 shrink-0" />
            <span className="tabular-nums">:13370/v1</span>
          </div>
          <div className="flex items-center gap-1.5">
            {copiedPort ? (
              <span className="text-[10px] font-mono text-phosphor-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Copied
              </span>
            ) : (
              <Copy className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            )}
          </div>
        </div>

        {/* Server Status Pill */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11px] font-medium text-zinc-400">Daemon</span>
          <ServerStatusPill state={serverState} />
        </div>
      </div>
    </aside>
  );
}
