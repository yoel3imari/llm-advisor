import { render, type RenderResult } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import type { ChatEvent } from '../types/chat';

export interface ChatErrorInfo {
  code: string;
  message: string;
}

export interface ChatEndOptions {
  done?: boolean;
  error?: ChatErrorInfo;
}

export class FakeChatChannel {
  onmessage?: (event: ChatEvent) => void;
  sent: ChatEvent[] = [];

  emit(deltas: string[], end: ChatEndOptions = { done: true }): void {
    for (const delta of deltas) {
      const event: ChatEvent = { type: 'token', delta };
      this.sent.push(event);
      this.onmessage?.(event);
    }
    if (end.error) {
      const event: ChatEvent = {
        type: 'error',
        code: end.error.code,
        message: end.error.message,
      };
      this.sent.push(event);
      this.onmessage?.(event);
    } else if (end.done !== false) {
      const event: ChatEvent = { type: 'done' };
      this.sent.push(event);
      this.onmessage?.(event);
    }
  }

  collectedText(): string {
    return this.sent
      .filter((e): e is { type: 'token'; delta: string } => e.type === 'token')
      .map((e) => e.delta)
      .join('');
  }

  lastEvent(): ChatEvent | undefined {
    return this.sent[this.sent.length - 1];
  }
}

export function mockChatChannel(
  tokenDeltas: string[],
  end: ChatEndOptions = { done: true }
): FakeChatChannel {
  const channel = new FakeChatChannel();
  channel.emit(tokenDeltas, end);
  return channel;
}

export function mockInvokeOnce(response: unknown): void {
  (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    response
  );
}

export function sseDeltaLines(deltas: string[]): string[] {
  const lines = deltas.map(
    (delta) => `data: {"choices":[{"delta":{"content":${JSON.stringify(delta)}}]}`
  );
  lines.push('data: [DONE]');
  return lines;
}

export function rapidBurstDeltas(count: number, char = 'x'): string[] {
  return Array.from({ length: count }, () => char);
}

export function simulateStall(durationMs: number): Promise<{ stalledForMs: number }> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve({ stalledForMs: durationMs }), durationMs);
  });
}

export function renderWithChatProviders(ui: ReactElement): RenderResult {
  return render(ui);
}
