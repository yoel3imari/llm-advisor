import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatView } from './ChatView';
import { MessageList } from '../components/chat/MessageBubble';
import { chatStream, chatCancel, listLibraryModels, startServer } from '../ipc/commands';
import type { ChatStreamCallbacks } from '../ipc/commands';
import type { ChatMessage } from '../types/chat';

vi.mock('../ipc/commands', () => ({
  chatStream: vi.fn(),
  chatCancel: vi.fn(),
  listLibraryModels: vi.fn(),
  startServer: vi.fn(),
  getServerState: vi.fn().mockResolvedValue(null),
  getCatalog: vi.fn().mockResolvedValue([]),
}));

function mockStreamingSession(sessionId = 'sess-stream-polish') {
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

describe('Chat polish & a11y', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listLibraryModels).mockReset();
    vi.mocked(listLibraryModels).mockResolvedValue([
      {
        entry_id: 'llama-3-8b',
        file_path: '/models/llama.gguf',
        size_bytes: 1000,
        verified: true,
        added_at: '2026-01-01T00:00:00Z',
      },
    ]);
    vi.mocked(startServer).mockReset();
    vi.mocked(startServer).mockResolvedValue(13370);
    vi.mocked(chatStream).mockReset();
    vi.mocked(chatCancel).mockReset();
    vi.mocked(chatCancel).mockResolvedValue(undefined);
  });

  it('renders polished empty state with illustration and shimmer dots while streaming', async () => {
    const session = mockStreamingSession();
    render(<ChatView modelId="llama-3-8b" />);

    // Empty state illustration & text
    expect(screen.getByText(/Start a conversation/i)).toBeDefined();
    expect(screen.getByText(/Ask about your model/i)).toBeDefined();

    // Send a message
    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Hello' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    // Check streaming shimmer dots are visible while streaming
    expect(screen.getByTestId('streaming-shimmer')).toBeDefined();

    // Complete stream
    act(() => {
      session.callbacks().onToken('Hi there!');
      session.callbacks().onDone();
    });

    // Shimmer dots should disappear once done
    expect(screen.queryByTestId('streaming-shimmer')).toBeNull();
  });

  it('renders 100 messages within 1 second and ensures aria-live and log roles are present', () => {
    const hundredMessages: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message content line ${i} with explanation and code`,
      createdAt: '2026-09-24T12:00:00Z',
    }));

    const start = performance.now();
    const { container } = render(<MessageList messages={hundredMessages} />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);

    const logElement = container.querySelector('[role="log"]');
    expect(logElement).not.toBeNull();
    expect(logElement?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelectorAll('[data-testid^="message-"]').length).toBe(100);
  });
});
