import { Markdown } from './Markdown';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../types/chat';

export interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
}

export function MessageBubble({
  message,
  streaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser
            ? 'max-w-[85%] rounded-2xl px-4 py-2.5 bg-zinc-800 border border-zinc-700/80 text-zinc-100'
            : 'w-full max-w-full rounded-2xl px-1 py-1 bg-transparent text-zinc-100',
          streaming && !isUser && 'animate-pulse'
        )}
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
                <span className="h-1.5 w-1.5 rounded-full bg-telemetry-400 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-telemetry-400 animate-pulse [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-telemetry-400 animate-pulse [animation-delay:400ms]" />
              </span>
            )}
          </div>
        )}
      </div>
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
