import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Markdown } from './Markdown';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../types/chat';

export function MessageBubble({
  message,
  streaming = false,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full gap-2.5', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`message-${message.role}`}
    >
      {!isUser && (
        <Avatar className="mt-0.5">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2',
          isUser
            ? 'bg-zinc-800 text-zinc-100'
            : 'border border-zinc-800 bg-zinc-900 text-zinc-200',
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
                className="inline-flex items-center gap-1 py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse [animation-delay:400ms]" />
              </span>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="mt-0.5">
          <AvatarFallback>You</AvatarFallback>
        </Avatar>
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
    <div role="log" aria-live="polite" className="flex flex-col gap-3">
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
