import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCancel, chatStream, type ChatStreamCallbacks } from '../ipc/commands';
import { useChatStream } from './useChatStream';

vi.mock('../ipc/commands', () => ({
  chatStream: vi.fn(),
  chatCancel: vi.fn(),
}));

function mockStreamingSession(sessionId = 'chat-test-1') {
  let captured: ChatStreamCallbacks | undefined;
  vi.mocked(chatStream).mockImplementation(async (_request, callbacks) => {
    captured = callbacks;
    return sessionId;
  });
  return {
    callbacks: () => {
      if (!captured) throw new Error('chatStream was not called');
      return captured;
    },
  };
}

describe('useChatStream', () => {
  beforeEach(() => {
    vi.mocked(chatStream).mockReset();
    vi.mocked(chatCancel).mockReset();
    vi.mocked(chatCancel).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates deltas into the assistant message and completes', async () => {
    const session = mockStreamingSession();
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('hi');
    });
    expect(result.current.status).toBe('warming');

    act(() => {
      session.callbacks().onToken('Hello');
    });
    expect(result.current.status).toBe('streaming');

    act(() => {
      session.callbacks().onToken(' world');
    });
    act(() => {
      session.callbacks().onDone();
    });

    const msgs = result.current.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(msgs[1]).toMatchObject({ role: 'assistant', content: 'Hello world' });
    expect(result.current.status).toBe('done');
    expect(result.current.isSending).toBe(false);
  });

  it('ignores empty sends and sends while streaming', async () => {
    mockStreamingSession();
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('   ');
    });
    expect(vi.mocked(chatStream)).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.send('first');
    });
    await act(async () => {
      await result.current.send('second');
    });
    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(1);
  });

  it('propagates stream errors with code', async () => {
    const session = mockStreamingSession();
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('hi');
    });
    act(() => {
      session.callbacks().onToken('par');
    });
    act(() => {
      session.callbacks().onError('SIDECAR_DIED', 'sidecar exited');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual({
      code: 'SIDECAR_DIED',
      message: 'sidecar exited',
    });
    expect(result.current.messages[1].content).toBe('par');
  });

  it('cancel aborts the session and returns to idle', async () => {
    mockStreamingSession('chat-test-9');
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('hi');
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(vi.mocked(chatCancel)).toHaveBeenCalledWith('chat-test-9');
    expect(result.current.status).toBe('idle');
  });

  it('cancels the in-flight session on unmount', async () => {
    mockStreamingSession('chat-test-7');
    const { result, unmount } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('hi');
    });
    unmount();

    expect(vi.mocked(chatCancel)).toHaveBeenCalledWith('chat-test-7');
  });

  it('surfaces TIMEOUT after the stall window with no tokens', async () => {
    vi.useFakeTimers();
    mockStreamingSession();
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1', stallTimeoutMs: 1000 })
    );

    await act(async () => {
      await result.current.send('hi');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('TIMEOUT');
  });

  it('retry resends the last user message', async () => {
    const session = mockStreamingSession();
    const { result } = renderHook(() =>
      useChatStream({ model: 'model-1' })
    );

    await act(async () => {
      await result.current.send('hello again');
    });
    act(() => {
      session.callbacks().onError('SIDECAR_DIED', 'boom');
    });
    expect(result.current.status).toBe('error');

    await act(async () => {
      await result.current.retry();
    });

    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(2);
    const lastCall = vi.mocked(chatStream).mock.calls[1][0];
    expect(lastCall.messages.at(-1)).toMatchObject({
      role: 'user',
      content: 'hello again',
    });
  });
});
