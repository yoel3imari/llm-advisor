import { useState } from 'react';
import { Plus, Trash2, Terminal } from 'lucide-react';
import { ScrollArea } from '../ui/ScrollArea';
import { Button } from '../ui/Button';
import { DeleteConfirmDialog } from '../ui/DeleteConfirmDialog';
import { type ChatSession, generateTitle } from '../../types/chat';
import { cn } from '../../lib/utils';

export interface HistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onToggleCollapse?: () => void;
  className?: string;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function HistorySidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  className,
}: HistorySidebarProps) {
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-obsidian-950 border-r border-white/[0.07] w-64 select-none shrink-0 relative z-10',
        className
      )}
    >
      {/* New Session Header */}
      <div className="p-3 border-b border-white/[0.07]">
        <Button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-telemetry-500 hover:bg-telemetry-400 text-obsidian-950 font-bold py-2 rounded-xl text-xs transition-all hardware-button-tactile"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Chat</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-zinc-500">
            <Terminal className="w-8 h-8 mb-2 stroke-[1.5] text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">No previous conversations</p>
            <p className="text-[11px] text-zinc-600 mt-0.5 font-mono">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="py-2 px-1.5 space-y-1">
            {sessions.map((session) => {
              const title = session.title || generateTitle(session.messages) || 'New Chat';
              const firstUserMsg = session.messages.find((m) => m.role === 'user');
              const snippet = firstUserMsg?.content;
              const isActive = activeSessionId === session.id;

              return (
                <div
                  key={session.id}
                  data-testid={`history-item-${session.id}`}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'group relative flex flex-col gap-1 p-2.5 rounded-xl cursor-pointer transition-all text-left border mx-1',
                    isActive
                      ? 'bg-zinc-800 text-white border-white/[0.12] shadow-bevel'
                      : 'border-transparent hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-100'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-telemetry-400 shadow-glow-cyan" />
                  )}

                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold truncate flex-1">{title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(session);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-obsidian-800 text-zinc-500 hover:text-laser-400 transition-all"
                      title="Delete Chat"
                      aria-label="Delete Chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {snippet && (
                    <p className="text-[11px] text-zinc-400 line-clamp-1 truncate font-normal">
                      {snippet}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums mt-0.5">
                    <span className="truncate max-w-[120px] text-telemetry-400/80">{session.modelId}</span>
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {deleteTarget && (
        <DeleteConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          modelId={deleteTarget.title || deleteTarget.modelId || 'Chat Session'}
          title="Delete Chat"
          description="Are you sure you want to delete this chat session? This action cannot be undone."
          confirmButtonText="Delete Chat"
          onConfirm={() => {
            onDeleteSession(deleteTarget.id);
          }}
        />
      )}
    </aside>
  );
}
