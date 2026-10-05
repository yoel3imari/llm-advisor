import { useState, useEffect } from 'react';
import { Plus, Trash2, Terminal, Pencil, Sparkles, Check, X, Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/ScrollArea';
import { Button } from '../ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';
import { type ChatSession, generateHeuristicTitle } from '../../types/chat';
import { cn } from '../../lib/utils';

export interface HistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onRegenerateTitle?: (id: string) => void;
  regeneratingSessionId?: string | null;
  onToggleCollapse?: () => void;
  /** Collapses the panel in place (width + opacity) rather than unmounting it. */
  isOpen?: boolean;
  className?: string;
}

export function HistorySidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  onRegenerateTitle,
  regeneratingSessionId,
  isOpen = true,
  className,
}: HistorySidebarProps) {
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (!confirmingSessionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmingSessionId(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-delete-btn="${confirmingSessionId}"]`)) {
        return;
      }
      setConfirmingSessionId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [confirmingSessionId]);

  // The active session is a freshly created chat with no messages yet, so another
  // new chat would only add an empty duplicate to the history.
  const isCurrentChatNewAndEmpty =
    activeSessionId != null &&
    sessions.some((session) => session.id === activeSessionId && session.messages.length === 0);

  return (
    <aside
      aria-label="Session history"
      data-testid="history-sidebar"
      data-open={isOpen ? 'true' : 'false'}
      className={cn(
        'flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none shrink-0 relative z-10 transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden will-change-[width]',
        isOpen ? 'w-64 max-w-[80vw] opacity-100' : 'w-0 opacity-0 border-transparent pointer-events-none',
        className
      )}
    >
      {/* New Session Header */}
      <div
        className={cn(
          'p-3 border-b border-slate-200 dark:border-slate-800 w-full overflow-hidden shrink-0 transition-opacity duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
          isOpen ? 'opacity-100 delay-75' : 'opacity-0'
        )}
      >
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Span keeps hover events alive so the tooltip can explain why the
                disabled button is inert (disabled buttons have pointer-events-none). */}
              <span className="block w-full">
                <Button
                  disabled={isCurrentChatNewAndEmpty}
                  onClick={() => {
                    setConfirmingSessionId(null);
                    onNewChat();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:shadow-none text-white font-bold py-2 rounded-xl text-xs transition-all shadow-corporate-btn hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>New Chat</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isCurrentChatNewAndEmpty ? 'Already in a new empty chat' : 'Start a new chat'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ScrollArea
        className={cn(
          'flex-1 min-h-0 w-full overflow-hidden custom-scrollbar transition-opacity duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] [&>div>div]:!block [&>div>div]:!w-full [&>div>div]:!min-w-0',
          isOpen ? 'opacity-100 delay-75' : 'opacity-0'
        )}
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-slate-400">
            <Terminal className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No previous conversations</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="py-2 px-1.5 space-y-1 w-full min-w-0 max-w-full overflow-hidden">
            {sessions.map((session) => {
              const title = session.title || generateHeuristicTitle(session.messages) || 'New Chat';
              const isActive = activeSessionId === session.id;
              const isConfirming = confirmingSessionId === session.id;
              const isEditing = editingSessionId === session.id;
              const isRegenerating = regeneratingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  data-testid={`history-item-${session.id}`}
                  onClick={() => {
                    if (confirmingSessionId) {
                      setConfirmingSessionId(null);
                    }
                    if (!isEditing) {
                      onSelectSession(session.id);
                    }
                  }}
                  className={cn(
                    'group relative flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all text-left border w-full min-w-0 max-w-full overflow-hidden',
                    isActive
                      ? 'bg-indigo-50/80 dark:bg-slate-800 text-indigo-950 dark:text-white border-indigo-100 dark:border-slate-700 shadow-sm font-semibold bg-zinc-800/0'
                      : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-600 to-violet-600 shadow-corporate-btn" />
                  )}

                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 flex-1 min-w-0 w-full overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editTitle.trim() && onRenameSession) {
                              onRenameSession(session.id, editTitle.trim());
                            }
                            setEditingSessionId(null);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingSessionId(null);
                          }
                        }}
                        data-testid={`rename-input-${session.id}`}
                        aria-label="Rename conversation"
                        className="text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-indigo-500 rounded px-1.5 py-0.5 min-w-0 flex-1 outline-none font-medium"
                      />
                      <button
                        type="button"
                        data-testid={`save-rename-${session.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editTitle.trim() && onRenameSession) {
                            onRenameSession(session.id, editTitle.trim());
                          }
                          setEditingSessionId(null);
                        }}
                        title="Save Title"
                        aria-label="Save Title"
                        className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`cancel-rename-${session.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(null);
                        }}
                        title="Cancel Rename"
                        aria-label="Cancel Rename"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="text-xs font-semibold truncate flex-1 min-w-0 overflow-hidden"
                        title={title}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setEditTitle(title);
                        }}
                      >
                        {title}
                      </span>

                      <div
                        className="flex items-center gap-0.5 shrink-0 ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onRenameSession && !isConfirming && (
                          <button
                            type="button"
                            data-testid={`rename-session-${session.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditTitle(title);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-all shrink-0"
                            title="Rename Chat"
                            aria-label="Rename Chat"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onRegenerateTitle && !isConfirming && (
                          <button
                            type="button"
                            data-testid={`regenerate-title-${session.id}`}
                            disabled={isRegenerating || session.messages.length === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRegenerateTitle(session.id);
                            }}
                            className={cn(
                              'p-1.5 rounded-lg transition-all shrink-0',
                              isRegenerating
                                ? 'opacity-100 text-indigo-500'
                                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none'
                            )}
                            title="Regenerate Title"
                            aria-label="Regenerate Title"
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          data-testid={`delete-session-${session.id}`}
                          data-delete-btn={session.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isConfirming) {
                              onDeleteSession(session.id);
                              setConfirmingSessionId(null);
                            } else {
                              setConfirmingSessionId(session.id);
                            }
                          }}
                          className={cn(
                            'p-1.5 rounded-lg transition-all shrink-0',
                            isConfirming
                              ? 'opacity-100 bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
                              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                          )}
                          title={isConfirming ? 'Confirm Delete Chat' : 'Delete Chat'}
                          aria-label={isConfirming ? 'Confirm Delete Chat' : 'Delete Chat'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
