import { useState } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
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
        'flex flex-col h-full bg-zinc-950 border-r border-zinc-800 w-64 select-none shrink-0',
        className
      )}
    >
      <div className="p-3 border-b border-zinc-800">
        <Button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-xs shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-zinc-500">
            <MessageSquare className="w-8 h-8 mb-2 stroke-[1.5] text-zinc-600" />
            <p className="text-xs font-medium">No previous conversations</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="py-2 px-1 space-y-1">
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
                    'group relative flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent mx-1.5',
                    isActive
                      ? 'bg-zinc-800 text-white border-zinc-700/60 shadow-sm'
                      : 'hover:bg-zinc-900/80 text-zinc-300 hover:text-zinc-100'
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-medium truncate flex-1">{title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(session);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700/80 text-zinc-400 hover:text-red-400 transition-opacity"
                      title="Delete Chat"
                      aria-label="Delete Chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {snippet && (
                    <p className="text-[11px] text-zinc-400/80 line-clamp-1 truncate font-normal">
                      {snippet}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-0.5">
                    <span className="truncate max-w-[120px]">{session.modelId}</span>
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
