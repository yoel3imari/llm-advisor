import { useCallback, useEffect, useRef, useState } from 'react';
import { chatCancel, chatStream } from '../ipc/commands';
import {
  defaultParams,
  newMessage,
  type ChatMessage,
  type ChatParams,
} from '../types/chat';

export type ChatStatus = 'idle' | 'warming' | 'streaming' | 'done' | 'error';

export interface ChatStreamError {
  code: string;
  message: string;
}

export interface UseChatStreamOptions {
  model: string | null;
  params?: ChatParams;
  stallTimeoutMs?: number;
  initialMessages?: ChatMessage[];
}

export function useChatStream({
  model,
  params,
  stallTimeoutMs = 30000,
  initialMessages,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<ChatStreamError | null>(null);
  const [stickEnabled, setStickEnabled] = useState(true);

  const sessionRef = useRef<string | null>(null);
  const stallTimer = useRef<number | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const activeRef = useRef(false);

  const clearStall = useCallback(() => {
    if (stallTimer.current !== undefined) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = undefined;
    }
  }, []);

  const handleTimeout = useCallback(() => {
    activeRef.current = false;
    sessionRef.current = null;
    setStatus('error');
    setError({ code: 'TIMEOUT', message: 'No tokens received — Continue?' });
  }, []);

  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = window.setTimeout(handleTimeout, stallTimeoutMs);
  }, [clearStall, handleTimeout, stallTimeoutMs]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || activeRef.current || !model) return;
      activeRef.current = true;
      setError(null);
      setStatus('warming');

      const userMsg = newMessage('user', text);
      const assistantMsg = newMessage('assistant', '');
      const history = [...messagesRef.current, userMsg];
      const next = [...history, assistantMsg];
      messagesRef.current = next;
      setMessages(next);

      const merged = { ...defaultParams(), ...params };
      const payload = [
        ...(merged.systemPrompt
          ? [{ role: 'system' as const, content: merged.systemPrompt }]
          : []),
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      armStall();
      try {
        const sessionId = await chatStream(
          {
            model,
            messages: payload,
            stream: true,
            temperature: merged.temperature,
            max_tokens: merged.maxTokens,
          },
          {
            onToken: (delta: string) => {
              setStatus((s) => (s === 'warming' ? 'streaming' : s));
              armStall();
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const last = prev[prev.length - 1];
                if (last.role !== 'assistant') {
                  const grown = [...prev, newMessage('assistant', delta)];
                  messagesRef.current = grown;
                  return grown;
                }
                const grown = [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + delta },
                ];
                messagesRef.current = grown;
                return grown;
              });
            },
            onDone: () => {
              activeRef.current = false;
              sessionRef.current = null;
              clearStall();
              setStatus('done');
            },
            onError: (code: string, message: string) => {
              activeRef.current = false;
              sessionRef.current = null;
              clearStall();
              setStatus('error');
              setError({ code, message });
            },
          }
        );
        sessionRef.current = sessionId;
      } catch (e) {
        activeRef.current = false;
        sessionRef.current = null;
        clearStall();
        setStatus('error');
        setError({ code: 'INVOKE_FAILED', message: String(e) });
      }
    },
    [model, params, armStall, clearStall]
  );

  const cancel = useCallback(async () => {
    const sid = sessionRef.current;
    sessionRef.current = null;
    activeRef.current = false;
    clearStall();
    if (sid) {
      try {
        await chatCancel(sid);
      } catch {
        /* cancel is best-effort */
      }
    }
    setStatus('idle');
  }, [clearStall]);

  const retry = useCallback(async () => {
    const history = messagesRef.current;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        const trimmed = history.slice(0, i);
        messagesRef.current = trimmed;
        setMessages(trimmed);
        await send(history[i].content);
        return;
      }
    }
  }, [send]);

  const stickToBottom = useCallback(() => {
    const el = bottomRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(
    () => () => {
      clearStall();
      const sid = sessionRef.current;
      if (sid) {
        chatCancel(sid).catch(() => {});
      }
    },
    [clearStall]
  );

  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    messagesRef.current = msgs;
    setMessages(msgs);
  }, []);

  return {
    messages,
    setMessages,
    loadMessages,
    status,
    error,
    isSending: status === 'warming' || status === 'streaming',
    send,
    cancel,
    retry,
    bottomRef,
    stickEnabled,
    setStickEnabled,
    stickToBottom,
  };
}
