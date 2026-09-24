import * as React from 'react';
import { MessageSquare, SlidersHorizontal, ArrowDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { PromptForm } from './PromptForm';
import { ModelSelector } from './ModelSelector';
import { ParamsPanel } from './ParamsPanel';
import { HistorySidebar } from './HistorySidebar';
import { MessageList } from './MessageBubble';
import { useChatStream } from '../../hooks/useChatStream';
import {
  defaultParams,
  newSession,
  generateTitle,
  type ChatSession,
  type ChatParams,
} from '../../types/chat';
import { loadSessions, saveSessions } from '../../lib/chat-store';
import { ChatErrors } from './ChatErrors';
import { checkContextLimit, truncateHistoryForContext } from '../../lib/token-estimate';
import { startServer } from '../../ipc/commands';

export interface ChatViewProps {
  modelId?: string | null;
  initialSessions?: ChatSession[];
}

export function ChatView({
  modelId: propModelId = null,
  initialSessions,
}: ChatViewProps) {
  const [activeModelId, setActiveModelId] = React.useState<string | null>(propModelId);
  const [runningModelId, setRunningModelId] = React.useState<string | null>(propModelId);
  const [sessions, setSessions] = React.useState<ChatSession[]>(() => {
    if (initialSessions !== undefined) return initialSessions;
    return loadSessions();
  });
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(() => {
    if (initialSessions !== undefined) return initialSessions[0]?.id ?? null;
    const stored = loadSessions();
    return stored[0]?.id ?? null;
  });
  const [params, setParams] = React.useState<ChatParams>(defaultParams());
  const [showParams, setShowParams] = React.useState(false);
  const [truncatedCount, setTruncatedCount] = React.useState(0);

  // Save sessions to localStorage on changes
  React.useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Auto-scroll management
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  // Keep prop model synced if changed
  React.useEffect(() => {
    if (propModelId) {
      setActiveModelId(propModelId);
      setRunningModelId(propModelId);
    }
  }, [propModelId]);

  const {
    messages,
    error,
    isSending,
    send,
    cancel,
    retry,
    bottomRef,
    loadMessages,
  } = useChatStream({
    model: activeModelId,
    params,
    initialMessages: initialSessions?.[0]?.messages ?? sessions[0]?.messages ?? [],
  });

  const contextStatus = React.useMemo(
    () => checkContextLimit(messages, params.contextSize),
    [messages, params.contextSize]
  );

  // Handle manual scroll to pause auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom =
      scrollHeight <= clientHeight || scrollHeight - clientHeight - scrollTop <= 40;
    setIsAtBottom(atBottom);
  };

  const jumpToBottom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
    setIsAtBottom(true);
  };

  // Stick to bottom on new tokens/messages if auto-scroll is not paused
  React.useEffect(() => {
    if (isAtBottom && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  // Sync current conversation messages into the active session
  React.useEffect(() => {
    if (!activeSessionId || messages.length === 0) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const title = s.title || generateTitle(messages);
        return {
          ...s,
          title,
          messages,
          params,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [messages, activeSessionId, params]);

  const handleSend = async (content: string) => {
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const created = newSession(activeModelId || '');
      created.title = content.slice(0, 40);
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      currentSessionId = created.id;
    }

    // Check context truncation (>95%)
    const prospective = [
      ...messages,
      { id: 'temp', role: 'user' as const, content, createdAt: new Date().toISOString() },
    ];
    const truncation = truncateHistoryForContext(prospective, params.contextSize);
    if (truncation.truncatedCount > 0) {
      setTruncatedCount(truncation.truncatedCount);
      loadMessages(truncation.messages.slice(0, -1));
    }

    await send(content);
  };

  const handleSelectSession = (id: string) => {
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setActiveSessionId(found.id);
      if (found.modelId) setActiveModelId(found.modelId);
      setParams(found.params);
      loadMessages(found.messages);
    }
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      loadMessages([]);
    }
  };

  const handleNewChat = () => {
    const created = newSession(activeModelId || '');
    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    loadMessages([]);
  };

  return (
    <div className="flex h-full w-full bg-zinc-950 overflow-hidden">
      {/* Session History Sidebar */}
      <HistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-zinc-950">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 bg-zinc-950/80 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Chat</h2>
            </div>
            <div className="w-56">
              <ModelSelector
                selectedModelId={activeModelId}
                runningModelId={runningModelId}
                isStreaming={isSending}
                contextSize={params.contextSize}
                onSelect={(id) => {
                  setActiveModelId(id);
                  setRunningModelId(id);
                  if (!activeSessionId) {
                    const created = newSession(id);
                    setSessions((prev) => [created, ...prev]);
                    setActiveSessionId(created.id);
                  }
                }}
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowParams((o) => !o)}
            aria-label="Parameters"
            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Parameters</span>
          </Button>
        </header>

        {/* Collapsible Parameters Panel */}
        {showParams && (
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/60 animate-in fade-in-0 duration-150">
            <ParamsPanel params={params} onChange={setParams} defaultOpen={true} />
          </div>
        )}

        {/* Scrollable Message List */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <ScrollArea
            className="flex-1 px-4 py-4"
            viewportRef={viewportRef}
            onViewportScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 py-16 text-center">
                <MessageSquare className="h-8 w-8 text-zinc-700" />
                <p className="text-sm font-medium text-zinc-300">Start a conversation</p>
                {!activeModelId ? (
                  <p className="text-xs text-zinc-500">Select a model to begin</p>
                ) : (
                  <p className="text-xs text-zinc-500">Ask about your model or begin chatting</p>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto w-full pb-4">
                <MessageList
                  messages={messages}
                  streamingMessageId={isSending ? messages[messages.length - 1]?.id : null}
                />
                <div ref={bottomRef} className="h-2" />
              </div>
            )}
          </ScrollArea>

          {/* Jump to Bottom Floating Button */}
          {!isAtBottom && (
            <button
              type="button"
              onClick={jumpToBottom}
              aria-label="Jump to bottom"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-xs font-medium text-zinc-200 shadow-xl border border-zinc-700 transition-all z-20 backdrop-blur-sm"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Jump to bottom</span>
            </button>
          )}
        </div>

        {/* Footer Prompt Input & Error Banners */}
        <footer className="border-t border-zinc-800 p-3 bg-zinc-950">
          <div className="max-w-3xl mx-auto w-full space-y-2">
            <ChatErrors
              error={error}
              contextWarning={contextStatus.warning}
              contextCritical={contextStatus.critical}
              contextTruncatedCount={truncatedCount}
              onStartModel={async () => {
                if (activeModelId) {
                  try {
                    await startServer(activeModelId, {
                      context_size: params.contextSize,
                      n_parallel: 1,
                      kv_type: 'q8_0',
                    });
                    setRunningModelId(activeModelId);
                    retry();
                  } catch (err) {
                    console.error('Failed to start model', err);
                  }
                }
              }}
              onRegenerate={retry}
              onContinue={retry}
            />
            <PromptForm
              onSend={handleSend}
              onCancel={cancel}
              isSending={isSending}
              hasModel={Boolean(activeModelId)}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
