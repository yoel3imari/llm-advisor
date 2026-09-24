import type { ChatMessage } from '../types/chat';

export function estimateTokens(input: number | string): number {
  const chars = typeof input === 'string' ? input.length : input;
  if (chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((acc, msg) => acc + estimateTokens(msg.content), 0);
}

export interface ContextLimitStatus {
  estimatedTokens: number;
  contextSize: number;
  ratio: number;
  warning: boolean; // >= 80%
  critical: boolean; // >= 95%
}

export function checkContextLimit(
  messages: Array<{ content: string }>,
  contextSize: number
): ContextLimitStatus {
  const estimatedTokens = estimateMessagesTokens(messages);
  const ratio = contextSize > 0 ? estimatedTokens / contextSize : 0;
  return {
    estimatedTokens,
    contextSize,
    ratio,
    warning: ratio >= 0.8,
    critical: ratio >= 0.95,
  };
}

export interface TruncationResult {
  messages: ChatMessage[];
  truncatedCount: number;
}

export function truncateHistoryForContext(
  messages: ChatMessage[],
  contextSize: number
): TruncationResult {
  const maxAllowedTokens = Math.floor(contextSize * 0.95);
  let currentTokens = estimateMessagesTokens(messages);

  if (currentTokens <= maxAllowedTokens) {
    return { messages, truncatedCount: 0 };
  }

  // Preserve system messages at the start
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = [...messages.filter((m) => m.role !== 'system')];
  let truncatedCount = 0;

  while (
    nonSystemMessages.length > 1 &&
    estimateMessagesTokens([...systemMessages, ...nonSystemMessages]) > maxAllowedTokens
  ) {
    nonSystemMessages.shift(); // remove oldest non-system message
    truncatedCount++;
  }

  return {
    messages: [...systemMessages, ...nonSystemMessages],
    truncatedCount,
  };
}
