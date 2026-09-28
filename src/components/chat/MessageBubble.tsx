import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Markdown } from './Markdown';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../types/chat';

export interface CopyMessageButtonProps {
  content: string;
  className?: string;
}

export function CopyMessageButton({
  content,
  className,
}: CopyMessageButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!content) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = content;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      } catch (err) {
        console.error('Failed to copy message:', err);
        return;
      }
    }
    setCopied(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy message'}
      data-testid="copy-message-btn"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer select-none',
        'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200',
        'hover:bg-slate-100 dark:hover:bg-slate-800/60',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500',
        copied && 'text-emerald-600 dark:text-emerald-400 font-semibold',
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
}

export function MessageBubble({
  message,
  streaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const showCopy = !streaming && Boolean(message.content?.trim());

  return (
    <div
      className={cn(
        'flex flex-col w-full',
        isUser ? 'items-end justify-end' : 'items-start justify-start'
      )}
      data-testid={`message-${message.role}`}
    >
      <div
        className={
          cn(
            isUser
              ? 'max-w-[85%] rounded-2xl px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-corporate-btn font-medium'
              : 'w-full max-w-full rounded-2xl px-1 py-1 bg-transparent text-slate-800 dark:text-slate-100',
            streaming && !isUser && 'animate-pulse'
          ) + (isUser ? ' bg-zinc-800/0' : '')
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-xs leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div>
            {message.content ? <Markdown content={message.content} /> : null}
            {streaming && (
              <span
                data-testid="streaming-shimmer"
                aria-label="Generating response"
                className="inline-flex items-center gap-1.5 py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse [animation-delay:400ms]" />
              </span>
            )}
          </div>
        )}
      </div>
      {showCopy && (
        <div
          className={cn(
            'flex items-center mt-1 px-1',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <CopyMessageButton content={message.content} />
        </div>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  streamingMessageId = null,
}: {
  messages: ChatMessage[];
  streamingMessageId?: string | null;
}) {
  return (
    <div role="log" aria-live="polite" className="flex flex-col gap-3.5">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          streaming={message.id === streamingMessageId}
        />
      ))}
    </div>
  );
}
