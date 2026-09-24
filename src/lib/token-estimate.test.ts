import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessagesTokens,
  checkContextLimit,
  truncateHistoryForContext,
} from './token-estimate';
import type { ChatMessage } from '../types/chat';

describe('token-estimate utility', () => {
  it('estimates tokens as ceil(chars / 4)', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
    expect(estimateTokens('Hello World')).toBe(3); // 11 chars -> ceil(11/4) = 3
  });

  it('estimates total tokens across messages', () => {
    const msgs: Array<{ content: string }> = [
      { content: '1234' }, // 1 token
      { content: '12345678' }, // 2 tokens
    ];
    expect(estimateMessagesTokens(msgs)).toBe(3);
  });

  it('checks context limits correctly at 80% warning and 95% critical', () => {
    // contextSize = 1000 tokens
    // 700 tokens -> below 80%
    const belowMsgs = [{ content: 'a'.repeat(2800) }]; // 700 tokens
    const status1 = checkContextLimit(belowMsgs, 1000);
    expect(status1.warning).toBe(false);
    expect(status1.critical).toBe(false);

    // 850 tokens -> warning
    const warnMsgs = [{ content: 'a'.repeat(3400) }]; // 850 tokens
    const status2 = checkContextLimit(warnMsgs, 1000);
    expect(status2.warning).toBe(true);
    expect(status2.critical).toBe(false);

    // 960 tokens -> critical
    const critMsgs = [{ content: 'a'.repeat(3840) }]; // 960 tokens
    const status3 = checkContextLimit(critMsgs, 1000);
    expect(status3.warning).toBe(true);
    expect(status3.critical).toBe(true);
  });

  it('truncates oldest non-system messages when exceeding 95% limit', () => {
    const contextSize = 100; // 95 tokens is limit (380 chars)
    const msgs: ChatMessage[] = [
      { id: '1', role: 'system', content: 'Sys', createdAt: '' }, // 1 token
      { id: '2', role: 'user', content: 'a'.repeat(200), createdAt: '' }, // 50 tokens
      { id: '3', role: 'assistant', content: 'b'.repeat(200), createdAt: '' }, // 50 tokens
      { id: '4', role: 'user', content: 'c'.repeat(40), createdAt: '' }, // 10 tokens
    ];

    const result = truncateHistoryForContext(msgs, contextSize);
    expect(result.truncatedCount).toBeGreaterThanOrEqual(1);
    // System message is preserved
    expect(result.messages[0].role).toBe('system');
    // New total tokens is below 95%
    const newTokens = estimateMessagesTokens(result.messages);
    expect(newTokens).toBeLessThanOrEqual(contextSize * 0.95);
  });
});
