import { useState, useEffect } from 'react';
import { Plus, Trash2, Terminal, Pencil, Sparkles, Check, X, Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/ScrollArea';
import { Button } from '../ui/Button';
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

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-50/70 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64 select-none shrink-0 relative z-10 transition-colors',
        className
      )}
    >
      {/* New Session Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <Button
          onClick={() => {
            setConfirmingSessionId(null);
            onNewChat();
          }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-corporate-btn hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Chat</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-slate-400">
            <Terminal className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No previous conversations</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="py-2 px-1.5 space-y-1">
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
                  className={
                    cn(
                      'group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-left border mx-1',
                      isActive
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm font-semibold'
                        : 'border-transparent hover:bg-white/80 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    ) + (isActive ? ' bg-zinc-800/0' : '')
                  }
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-600 to-violet-600 shadow-corporate-btn" />
                  )}

                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 flex-1 min-w-0"
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
                        className="text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-indigo-500 rounded px-1.5 py-0.5 w-full outline-none font-medium"
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
                        className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
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
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="text-xs font-semibold truncate flex-1 min-w-0"
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
                        className="flex items-center gap-0.5 shrink-0"
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
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-all"
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
                              'p-1.5 rounded-lg transition-all',
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
