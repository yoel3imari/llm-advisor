import * as React from 'react';
import {
  MessageSquare,
  SlidersHorizontal,
  ArrowDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Textarea } from '../components/ui/Textarea';
import { Input } from '../components/ui/Input';
import { Slider } from '../components/ui/Slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select';
import { PromptForm } from '../components/chat/PromptForm';
import { ModelSelector } from '../components/chat/ModelSelector';
import { HistorySidebar } from '../components/chat/HistorySidebar';
import { MessageList } from '../components/chat/MessageBubble';
import { ChatErrors } from '../components/chat/ChatErrors';
import { useChatStream } from '../hooks/useChatStream';
import {
  defaultParams,
  newSession,
  generateTitle,
  clampTemperature,
  type ChatSession,
  type ChatParams,
} from '../types/chat';
import { loadSessions, saveSessions } from '../lib/chat-store';
import { checkContextLimit, truncateHistoryForContext } from '../lib/token-estimate';
import { startServer } from '../ipc/commands';

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
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
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
    // console.log('[DEBUG 1: ChatView.handleSend] start', {
    //   content,
    //   activeModelId,
    //   activeSessionId,
    //   params,
    //   maxTokens: params?.maxTokens,
    // });
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const created = newSession(activeModelId || '');
      created.title = content.slice(0, 40);
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      currentSessionId = created.id;
      // console.log('[DEBUG 1a: ChatView.handleSend] created new session', currentSessionId);
    }

    // Check context truncation (>95%)
    const prospective = [
      ...messages,
      { id: 'temp', role: 'user' as const, content, createdAt: new Date().toISOString() },
    ];
    const truncation = truncateHistoryForContext(prospective, params.contextSize);
    // console.log('[DEBUG 1b: ChatView.handleSend] truncation check', truncation);
    if (truncation.truncatedCount > 0) {
      setTruncatedCount(truncation.truncatedCount);
      loadMessages(truncation.messages.slice(0, -1));
    }

    // console.log('[DEBUG 1c: ChatView.handleSend] calling useChatStream.send(content)...');
    await send(content);
    // console.log('[DEBUG 1d: ChatView.handleSend] send(content) call returned');
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

  const handleStartModel = async () => {
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
  };

  const handleModelSelect = (id: string) => {
    setActiveModelId(id);
    setRunningModelId(id);
    if (!activeSessionId) {
      const created = newSession(id);
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
    }
  };

  return (
    <div className="flex h-full w-full bg-obsidian-950 overflow-hidden relative z-10">
      {/* Session History Sidebar with Toggle */}
      {sidebarOpen && (
        <HistorySidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-obsidian-950 relative overflow-hidden">
        {/* Floating Sidebar Toggle Button & Chat Header Tag */}
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
            className="w-8 h-8 rounded-xl bg-obsidian-900/90 hover:bg-obsidian-850 text-zinc-400 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all hardware-button-tactile backdrop-blur-md"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-telemetry-400" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 text-telemetry-400" />
            )}
          </button>
          {messages.length > 0 && (
            <span className="text-xs font-semibold text-zinc-300 font-sans tracking-tight">Chat</span>
          )}
        </div>

        {messages.length === 0 ? (
          /* Empty Conversation: Prompt Input Centered in Middle */
          <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 relative select-none">
            <div className="flex flex-col items-center gap-2 mb-6 text-center max-w-md select-none">
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-obsidian-850 to-obsidian-900 border border-white/[0.1] flex items-center justify-center text-blaze-500 mb-1 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blaze-500/20 via-violet-500/20 to-transparent pointer-events-none" />
                <MessageSquare className="h-7 w-7 stroke-[1.5]" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight font-sans">Chat</h2>
                {activeModelId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-violet-950/50 text-violet-300 border border-violet-500/40">
                    {activeModelId}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-zinc-200 font-sans">Start a conversation</p>
              {!activeModelId ? (
                <p className="text-xs text-zinc-400 font-mono">Select a model to begin</p>
              ) : (
                <p className="text-xs text-zinc-400 font-mono">Ask about your model or begin chatting</p>
              )}
            </div>

            <div className="w-full max-w-2xl relative z-20 space-y-2">
              <ChatErrors
                error={error}
                contextWarning={contextStatus.warning}
                contextCritical={contextStatus.critical}
                contextTruncatedCount={truncatedCount}
                onStartModel={handleStartModel}
                onRegenerate={retry}
                onContinue={retry}
              />
              <PromptForm
                onSend={handleSend}
                onCancel={cancel}
                isSending={isSending}
                hasModel={Boolean(activeModelId)}
                onOpenParams={() => setShowParams((o) => !o)}
                modelSelector={
                  <ModelSelector
                    selectedModelId={activeModelId}
                    runningModelId={runningModelId}
                    isStreaming={isSending}
                    contextSize={params.contextSize}
                    onSelect={handleModelSelect}
                  />
                }
              />
            </div>
          </div>
        ) : (
          /* Active Conversation: Message List & Floating Prompt Input at Bottom */
          <div className="relative flex-1 min-h-0 flex flex-col pt-12">
            <ScrollArea
              className="flex-1 px-4 py-4 custom-scrollbar"
              viewportRef={viewportRef}
              onViewportScroll={handleScroll}
            >
              <div className="max-w-3xl mx-auto w-full pb-6">
                <MessageList
                  messages={messages}
                  streamingMessageId={isSending ? messages[messages.length - 1]?.id : null}
                />
                <div ref={bottomRef} className="h-2" />
              </div>
            </ScrollArea>

            {/* Jump to Bottom Button */}
            {!isAtBottom && (
              <button
                type="button"
                onClick={jumpToBottom}
                aria-label="Jump to bottom"
                className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-obsidian-850 hover:bg-obsidian-800 text-xs font-medium text-zinc-200 border border-white/[0.12] transition-all z-30 backdrop-blur-md hardware-button-tactile"
              >
                <ArrowDown className="w-3.5 h-3.5 text-telemetry-400" />
                <span className="font-mono text-[11px]">Jump to bottom</span>
              </button>
            )}

            {/* Floating Prompt Input at Bottom */}
            <div className="p-4 pt-1 max-w-3xl mx-auto w-full relative z-20 space-y-2">
              <ChatErrors
                error={error}
                contextWarning={contextStatus.warning}
                contextCritical={contextStatus.critical}
                contextTruncatedCount={truncatedCount}
                onStartModel={handleStartModel}
                onRegenerate={retry}
                onContinue={retry}
              />
              <PromptForm
                onSend={handleSend}
                onCancel={cancel}
                isSending={isSending}
                hasModel={Boolean(activeModelId)}
                onOpenParams={() => setShowParams((o) => !o)}
                modelSelector={
                  <ModelSelector
                    selectedModelId={activeModelId}
                    runningModelId={runningModelId}
                    isStreaming={isSending}
                    contextSize={params.contextSize}
                    onSelect={handleModelSelect}
                  />
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Parameters Tuning Modal */}
      {showParams && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat Parameters"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150"
          onClick={() => setShowParams(false)}
        >
          <div
            className="hardware-panel bg-obsidian-900 border border-white/[0.12] rounded-2xl w-full max-w-md p-5 relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-obsidian-850 border border-white/[0.08] flex items-center justify-center text-telemetry-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans tracking-tight">
                    Chat Parameters
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">Tune generation settings for this session</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowParams(false)}
                aria-label="Close parameters"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-1">
              {/* System Prompt */}
              <div className="space-y-1.5">
                <label htmlFor="chat-system-prompt" className="text-xs font-semibold text-zinc-300 font-sans">
                  System prompt
                </label>
                <Textarea
                  id="chat-system-prompt"
                  aria-label="System prompt"
                  value={params.systemPrompt}
                  onChange={(e) =>
                    setParams({ ...params, systemPrompt: e.target.value.slice(0, 8000) })
                  }
                  placeholder="You are a helpful assistant..."
                  rows={3}
                  className="resize-none bg-obsidian-950 border-white/[0.08] focus:border-telemetry-500/50 text-xs"
                />
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">Guides assistant personality</span>
                  <span className={params.systemPrompt.length >= 8000 ? 'text-red-400' : 'text-zinc-500'}>
                    {params.systemPrompt.length} / 8000
                  </span>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="chat-temperature" className="text-xs font-semibold text-zinc-300 font-sans">
                    Temperature
                  </label>
                  <span className="font-mono text-xs font-bold text-telemetry-400 tabular-nums">
                    {params.temperature.toFixed(1)}
                  </span>
                </div>
                <Slider
                  id="chat-temperature"
                  aria-label="Temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[params.temperature]}
                  onValueChange={([v]) => setParams({ ...params, temperature: clampTemperature(v) })}
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.0 (Deterministic)</span>
                  <span>1.0 (Balanced)</span>
                  <span>2.0 (Creative)</span>
                </div>
              </div>

              {/* Context Size & Max Tokens Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="chat-context-size" className="text-xs font-semibold text-zinc-300 font-sans">
                    Context Size
                  </label>
                  <Select
                    value={String(params.contextSize)}
                    onValueChange={(v) => setParams({ ...params, contextSize: Number(v) })}
                  >
                    <SelectTrigger id="chat-context-size" aria-label="Context size" className="bg-obsidian-950 border-white/[0.08]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-obsidian-900 border-white/[0.1]">
                      {[2048, 4096, 8192, 16384, 32768].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size.toLocaleString()} tokens
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="chat-max-tokens" className="text-xs font-semibold text-zinc-300 font-sans">
                    Max Tokens
                  </label>
                  <Input
                    id="chat-max-tokens"
                    aria-label="Max tokens"
                    type="number"
                    min={1}
                    max={32768}
                    value={params.maxTokens}
                    onChange={(e) =>
                      setParams({ ...params, maxTokens: Number(e.target.value) || 1 })
                    }
                    className="bg-obsidian-950 border-white/[0.08] focus:border-telemetry-500/50 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Done Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setShowParams(false)}
                  className="bg-telemetry-500 hover:bg-telemetry-400 text-obsidian-950 font-bold px-4 py-2 rounded-xl text-xs hardware-button-tactile"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
