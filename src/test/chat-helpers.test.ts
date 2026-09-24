import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { ChatEvent } from '../types/chat';
import {
  FakeChatChannel,
  mockChatChannel,
  mockInvokeOnce,
  sseDeltaLines,
  rapidBurstDeltas,
  simulateStall,
} from './chat-helpers';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: class MockChannel {
    onmessage: ((msg: unknown) => void) | undefined;
    constructor() {}
  },
}));

describe('chat test helpers', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('emits ordered token sequence ending with done', () => {
    const received: ChatEvent[] = [];
    const channel = new FakeChatChannel();
    channel.onmessage = (event) => received.push(event);

    channel.emit(['Hello', ' world'], { done: true });

    expect(channel.collectedText()).toBe('Hello world');
    expect(received).toHaveLength(3);
    expect(received[0]).toEqual({ type: 'token', delta: 'Hello' });
    expect(received[1]).toEqual({ type: 'token', delta: ' world' });
    expect(received[2]).toEqual({ type: 'done' });
  });

  it('mockChatChannel delivers tokens then done by default', () => {
    const channel = mockChatChannel(['Hello', ' world']);

    expect(channel.collectedText()).toBe('Hello world');
    expect(channel.lastEvent()).toEqual({ type: 'done' });
  });

  it('propagates error with code instead of done', () => {
    const received: ChatEvent[] = [];
    const channel = new FakeChatChannel();
    channel.onmessage = (event) => received.push(event);

    channel.emit(['par'], {
      error: { code: 'SIDECAR_DIED', message: 'sidecar exited' },
    });

    expect(channel.collectedText()).toBe('par');
    expect(channel.lastEvent()).toEqual({
      type: 'error',
      code: 'SIDECAR_DIED',
      message: 'sidecar exited',
    });
    expect(received).toHaveLength(2);
  });

  it('mockInvokeOnce resolves the next invoke call', async () => {
    mockInvokeOnce('ok-once');
    vi.mocked(invoke).mockResolvedValue('fallback');

    await expect(invoke('chat_stream')).resolves.toBe('ok-once');
    await expect(invoke('chat_stream')).resolves.toBe('fallback');
  });

  it('generates SSE delta lines ending with DONE', () => {
    const lines = sseDeltaLines(['Hi', ' there']);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"content":"Hi"');
    expect(lines[1]).toContain('"content":" there"');
    expect(lines[2]).toBe('data: [DONE]');
  });

  it('generates rapid-burst deltas without dropping order', () => {
    const channel = mockChatChannel(rapidBurstDeltas(150, 't'));

    expect(channel.collectedText()).toBe('t'.repeat(150));
    expect(channel.lastEvent()).toEqual({ type: 'done' });
  });

  it('simulateStall resolves after the stall window with no events', async () => {
    const channel = new FakeChatChannel();

    const result = await simulateStall(5);

    expect(result.stalledForMs).toBe(5);
    expect(channel.sent).toHaveLength(0);
  });
});
