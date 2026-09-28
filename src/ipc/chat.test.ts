import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tauri-apps/api/core')>();
  return {
    ...actual,
    invoke: (...args: unknown[]) =>
      (mockInvoke as (...a: unknown[]) => unknown)(...args),
    Channel: class MockChannel {
      onmessage: ((msg: unknown) => void) | undefined;
      constructor() {}
    },
  };
});

import { chatStream, chatCancel, chatGenerateTitle } from './commands';
import type { ChatStreamRequest, ChatMessage } from '../types/chat';

describe('chat IPC scaffold', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue('chat-42');
  });

  it('invokes chat_stream with model, messages and params', async () => {
    const request: ChatStreamRequest = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    };

    const sessionId = await chatStream(request, {
      onToken: () => {},
      onDone: () => {},
      onError: () => {},
    });

    expect(sessionId).toBe('chat-42');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'chat_stream',
      expect.objectContaining({ request })
    );
    const payload = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toHaveProperty('channel');
    const req = payload['request'] as Record<string, unknown>;
    expect(req).toHaveProperty('model', 'test-model');
    expect(req).toHaveProperty('messages');
    expect(req).toHaveProperty('stream', true);
  });

  it('invokes chat_cancel with session id', async () => {
    await chatCancel('sess-1');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('chat_cancel', {
      sessionId: 'sess-1',
    });
  });

  it('does not throw when cancelling with no active stream', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await expect(chatCancel('no-such-session')).resolves.toBeUndefined();
  });

  it('invokes chat_generate_title with messages and model', async () => {
    mockInvoke.mockResolvedValue('Rust Concurrency Patterns');
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Explain Rust channels', createdAt: '2026-09-27' },
    ];

    const title = await chatGenerateTitle(messages, 'test-model');
    expect(title).toBe('Rust Concurrency Patterns');
    expect(mockInvoke).toHaveBeenCalledWith('chat_generate_title', {
      messages,
      model: 'test-model',
    });
  });
});
