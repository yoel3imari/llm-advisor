import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  FolderDown,
  MessageSquare,
  PlayCircle,
  Settings,
  X,
  Terminal,
  Check,
  Copy,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { DownloadTask, ServerState } from '../../types/domain';
import { ServerStatusPill } from './ServerStatusPill';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

export type NavTab = 'chat' | 'dashboard' | 'library' | 'server' | 'settings';

export interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  serverState: ServerState;
  activeDownloads?: DownloadTask[];
  onCancelDownload?: (entryId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const STORAGE_KEY = 'llm-advisor-sidebar-collapsed';

// Labels clear fast on collapse (the shrinking rail clips them), and reappear only once expansion has widened it
const FADE_OUT = 'duration-150';
const FADE_IN = 'duration-200 delay-75';

function getStoredCollapsed(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
  } catch {
    // ignore
  }
  return false;
}

function setStoredCollapsed(value: boolean) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    // ignore
  }
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
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  className,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(getStoredCollapsed);
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const [copiedPort, setCopiedPort] = useState(false);

  const handleToggle = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        setStoredCollapsed(next);
        return next;
      });
    }
  }, [onToggleCollapse]);

  useEffect(() => {
    if (propIsCollapsed !== undefined) {
      setStoredCollapsed(propIsCollapsed);
    }
  }, [propIsCollapsed]);

  // Keyboard shortcut (Cmd+B or Ctrl+B) to toggle sidebar when not in input/textarea
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        const activeEl = document.activeElement;
        const isInput =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute('contenteditable') === 'true';
        if (!isInput) {
          e.preventDefault();
          handleToggle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  const navItems = [
    { id: 'chat' as NavTab, label: 'Chat', icon: MessageSquare, badge: null },
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: Cpu, badge: null },
    {
      id: 'library' as NavTab,
      label: 'Library',
      icon: FolderDown,
      badge: activeDownloads.length > 0 ? `${activeDownloads.length}` : null,
    },
    {
      id: 'server' as NavTab,
      label: 'Server Control',
      icon: PlayCircle,
      badge: serverState.state === 'serving' ? 'ON' : null,
    },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings, badge: null },
  ];

  const handleCopyEndpoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('http://127.0.0.1:13370/v1');
    }
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  };

  return (
    <aside
      data-testid="main-sidebar"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      aria-label="Main sidebar"
      className={cn(
        'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between py-4 select-none relative z-20 shadow-sm transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 overflow-x-hidden will-change-[width]',
        isCollapsed ? 'w-16 px-3' : 'w-64 px-4',
        className
      )}
    >
      <div className="space-y-6 w-full flex flex-col">
        {/* Hardware Header / Brand Lockup */}
        <div className="w-full flex flex-col">
          <div className="flex items-center min-h-[40px] w-full relative">
            {/* Logo container - fixed 40px x 40px */}
            <button
              type="button"
              onClick={handleToggle}
              data-testid="main-sidebar-logo"
              aria-label="LLM Advisor (Expand sidebar)"
              title={isCollapsed ? 'LLM Advisor (Click to expand)' : undefined}
              className={cn(
                'relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 dark:from-slate-800 dark:to-slate-850 border border-indigo-100 dark:border-slate-700 shadow-corporate flex items-center justify-center p-1.5 shrink-0 overflow-hidden group transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isCollapsed ? 'hover:ring-2 hover:ring-indigo-500/30 cursor-pointer' : 'cursor-default'
              )}
            >
              <img
                src="/app-icon.png"
                alt="LLM Advisor"
                className="w-full h-full object-contain filter drop-shadow transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/10 via-violet-600/10 to-transparent pointer-events-none" />
            </button>

            {/* Title & Hardware Inference text */}
            <div
              aria-hidden={isCollapsed}
              className={cn(
                'min-w-0 overflow-hidden whitespace-nowrap transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
                isCollapsed
                  ? `max-w-0 opacity-0 ml-0 -translate-x-3 pointer-events-none ${FADE_OUT}`
                  : `max-w-[130px] opacity-100 ml-3 translate-x-0 flex-1 ${FADE_IN}`
              )}
            >
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none font-sans">
                LLM Advisor
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono tracking-tight flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.6)] inline-block animate-pulse shrink-0"></span>
                HARDWARE INFERENCE
              </p>
            </div>

            {/* Collapse toggle button in expanded header row */}
            <div
              aria-hidden={isCollapsed}
              className={cn(
                'overflow-hidden transition-all ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0',
                isCollapsed
                  ? `max-w-0 opacity-0 pointer-events-none scale-75 ${FADE_OUT}`
                  : `max-w-8 opacity-100 scale-100 ml-auto ${FADE_IN}`
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleToggle}
                    data-testid={!isCollapsed ? 'main-sidebar-toggle' : undefined}
                    aria-label="Collapse sidebar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </TooltipTrigger>
                {!isCollapsed && <TooltipContent side="right">Collapse sidebar</TooltipContent>}
              </Tooltip>
            </div>
          </div>

          {/* Expand toggle button below logo when collapsed */}
            <div
              aria-hidden={!isCollapsed}
              className={cn(
                'w-full flex items-center justify-center overflow-hidden transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
                isCollapsed
                  ? `max-h-8 opacity-100 mt-2 scale-100 ${FADE_OUT}`
                  : `max-h-0 opacity-0 mt-0 scale-75 pointer-events-none ${FADE_IN}`
              )}
            >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleToggle}
                  data-testid={isCollapsed ? 'main-sidebar-toggle' : undefined}
                  aria-label="Expand sidebar"
                  className="w-10 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
            </Tooltip>
          </div>
        </div>

        {/* Navigation Rail */}
        <nav className="space-y-1.5 w-full flex flex-col" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectTab(item.id)}
                    aria-label={item.label}
                    className={cn(
                      'h-10 relative flex items-center rounded-xl text-xs tracking-wide transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group overflow-hidden select-none w-full justify-start pr-2.5',
                      isActive
                        ? 'bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/60 dark:text-white shadow-sm border border-indigo-100 dark:border-indigo-900/50 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold'
                    )}
                  >
                    {/* Active Indicator Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-600 to-violet-600 shadow-corporate-btn transition-all duration-300" />
                    )}

                    {/* Left side: Icon + Label (left-anchored so the rail clips, never re-centers) */}
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-colors duration-200',
                            isActive
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                          )}
                        />
                      </div>
                      <span
                        aria-hidden={isCollapsed}
                        className={cn(
                          'overflow-hidden whitespace-nowrap text-left transition-all ease-[cubic-bezier(0.16,1,0.3,1)] min-w-0',
                          isCollapsed
                            ? `max-w-0 opacity-0 -translate-x-2 pointer-events-none ${FADE_OUT}`
                            : `max-w-[120px] opacity-100 translate-x-0 ${FADE_IN}`
                        )}
                      >
                        {item.label}
                      </span>
                    </div>

                    {/* Right side: Badge in Expanded Mode */}
                    {item.badge && (
                      <span
                        aria-hidden={isCollapsed}
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold overflow-hidden whitespace-nowrap transition-all ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ml-auto',
                          isCollapsed
                            ? `max-w-0 opacity-0 scale-75 pointer-events-none px-0 ${FADE_OUT}`
                            : `max-w-[40px] opacity-100 scale-100 ${FADE_IN}`,
                          item.badge === 'ON'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800/60 animate-pulse'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Compact Mini Badges in Collapsed Mode */}
                    {item.badge && (
                      <span
                        aria-hidden={!isCollapsed}
                        className={cn(
                          'absolute transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
                          isCollapsed ? `opacity-100 scale-100 ${FADE_OUT}` : `opacity-0 scale-50 pointer-events-none ${FADE_IN}`,
                          item.badge === 'ON'
                            ? 'top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                            : '-top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-indigo-600 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse shadow-sm'
                        )}
                      >
                        {item.badge !== 'ON' ? item.badge : null}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" sideOffset={8} className="flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'px-1 py-0.2 rounded text-[9px] font-mono font-bold',
                          item.badge === 'ON'
                            ? 'bg-emerald-950/80 text-emerald-300'
                            : 'bg-indigo-950/80 text-indigo-300'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Dock */}
      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 w-full flex flex-col">
        {/* Active Downloads Section */}
        {activeDownloads.length > 0 && (
          <>
            {/* Collapsed Active Downloads Icon Button */}
            <div
              aria-hidden={!isCollapsed}
              className={cn(
                'w-full flex justify-center overflow-hidden transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
                isCollapsed
                  ? `max-h-10 opacity-100 scale-100 ${FADE_OUT}`
                  : `max-h-0 opacity-0 scale-75 pointer-events-none ${FADE_IN}`
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectTab('library')}
                    aria-label="Active downloads"
                    className="w-10 h-10 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 relative transition-all hover:scale-105"
                  >
                    <FolderDown className="w-4 h-4 animate-bounce" />
                    <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-3.5 rounded-full bg-indigo-600 text-white font-mono text-[8px] font-bold flex items-center justify-center">
                      {activeDownloads.length}
                    </span>
                  </button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" sideOffset={8}>
                    {activeDownloads.length} active download{activeDownloads.length > 1 ? 's' : ''} (Click to open Library)
                  </TooltipContent>
                )}
              </Tooltip>
            </div>

            {/* Expanded Active Downloads List */}
            <div
              aria-hidden={isCollapsed}
              className={cn(
                'space-y-2 overflow-hidden transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
                isCollapsed
                  ? `max-h-0 opacity-0 pointer-events-none ${FADE_OUT}`
                  : `max-h-48 opacity-100 ${FADE_IN}`
              )}
            >
              <div
                onClick={() => onSelectTab('library')}
                className="flex items-center justify-between px-1 cursor-pointer group"
                title="Click to open Library"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <FolderDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                  <span className="whitespace-nowrap">Active Downloads</span>
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
          </>
        )}

        {/* Local Gateway Port Dock */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopyEndpoint}
              aria-label={isCollapsed ? 'Copy local endpoint' : undefined}
              className="h-10 w-full justify-start rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center cursor-pointer group shadow-sm overflow-hidden select-none"
              title={!isCollapsed ? 'Click to copy local OpenAI endpoint (127.0.0.1:13370/v1)' : undefined}
            >
              <div className="flex items-center min-w-0 flex-1">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  {copiedPort ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform scale-110" />
                  ) : (
                    <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
                  )}
                </div>
                <span
                  aria-hidden={isCollapsed}
                  className={cn(
                    'text-[11px] font-mono text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-all ease-[cubic-bezier(0.16,1,0.3,1)] font-semibold tabular-nums overflow-hidden whitespace-nowrap min-w-0',
                    isCollapsed
                      ? `max-w-0 opacity-0 -translate-x-2 pointer-events-none ${FADE_OUT}`
                      : `max-w-[90px] opacity-100 translate-x-0 ${FADE_IN}`
                  )}
                >
                  :13370/v1
                </span>
              </div>

              <div
                aria-hidden={isCollapsed}
                className={cn(
                  'flex items-center overflow-hidden whitespace-nowrap transition-all ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ml-auto pr-2.5',
                  isCollapsed
                    ? `max-w-0 opacity-0 pointer-events-none ${FADE_OUT}`
                    : `max-w-[60px] opacity-100 ${FADE_IN}`
                )}
              >
                {copiedPort ? (
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copied
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" />
                )}
              </div>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" sideOffset={8}>
              {copiedPort ? 'Copied :13370/v1!' : 'Click to copy endpoint (127.0.0.1:13370/v1)'}
            </TooltipContent>
          )}
        </Tooltip>

        {/* Server Status Pill */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={() => onSelectTab('server')}
              aria-label={isCollapsed ? `Daemon: ${serverState.state}` : undefined}
              role={isCollapsed ? 'button' : undefined}
              tabIndex={isCollapsed ? 0 : undefined}
              className={cn(
                'flex items-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] min-h-[36px] w-full justify-start px-1',
                isCollapsed && 'rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <span
                aria-hidden={isCollapsed}
                className={cn(
                  'text-[11px] font-semibold text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap transition-all ease-[cubic-bezier(0.16,1,0.3,1)] min-w-0',
                  isCollapsed
                    ? `max-w-0 opacity-0 -translate-x-2 pointer-events-none ${FADE_OUT}`
                    : `max-w-[60px] opacity-100 translate-x-0 ${FADE_IN}`
                )}
              >
                Daemon
              </span>
              <div className="ml-auto shrink-0 flex items-center">
                <ServerStatusPill state={serverState} compact={isCollapsed} />
              </div>
            </div>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" sideOffset={8}>
              Daemon: {serverState.state === 'serving' ? 'Running' : serverState.state}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
