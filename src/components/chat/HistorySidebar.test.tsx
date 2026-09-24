import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistorySidebar } from './HistorySidebar';
import type { ChatSession } from '../../types/chat';

function createMockSession(id: string, overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    modelId: 'test-model',
    title: `Chat Session ${id}`,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: `First message of session ${id}`,
        createdAt: '2026-09-24T12:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `Assistant reply for ${id}`,
        createdAt: '2026-09-24T12:00:05Z',
      },
    ],
    params: {
      systemPrompt: '',
      temperature: 0.7,
      contextSize: 4096,
      maxTokens: 2048,
    },
    createdAt: '2026-09-24T12:00:00Z',
    updatedAt: '2026-09-24T12:05:00Z',
    ...overrides,
  };
}

describe('HistorySidebar Component', () => {
  it('renders empty state when there are no sessions', () => {
    render(
      <HistorySidebar
        sessions={[]}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
      />
    );

    expect(screen.getByText(/no chat history|no previous conversations/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeDefined();
  });

  it('renders a list of sessions with title, model, and message snippet', () => {
    const sessions = [
      createMockSession('sess-1', { title: 'First Session', modelId: 'llama-3-8b' }),
      createMockSession('sess-2', { title: 'Second Session', modelId: 'qwen-2.5-7b' }),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        activeSessionId="sess-1"
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
      />
    );

    expect(screen.getByText('First Session')).toBeDefined();
    expect(screen.getByText('Second Session')).toBeDefined();
    expect(screen.getByText('llama-3-8b')).toBeDefined();
    expect(screen.getByText('qwen-2.5-7b')).toBeDefined();
    expect(screen.getByText(/First message of session sess-1/)).toBeDefined();
  });

  it('calls onNewChat when clicking the New Chat button', () => {
    const onNewChat = vi.fn();
    render(
      <HistorySidebar
        sessions={[]}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={onNewChat}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectSession when clicking a session', () => {
    const onSelectSession = vi.fn();
    const sessions = [
      createMockSession('sess-1'),
      createMockSession('sess-2'),
      createMockSession('sess-3'),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={onSelectSession}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Chat Session sess-2'));
    expect(onSelectSession).toHaveBeenCalledWith('sess-2');
  });

  it('highlights active session', () => {
    const sessions = [
      createMockSession('sess-1'),
      createMockSession('sess-2'),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        activeSessionId="sess-2"
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
      />
    );

    const activeItem = screen.getByTestId('history-item-sess-2');
    expect(activeItem.className).toContain('bg-zinc-800');
  });

  it('opens delete confirmation dialog and cancels without deleting', async () => {
    const onDeleteSession = vi.fn();
    const sessions = [
      createMockSession('sess-1', { title: 'Session To Delete' }),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={onDeleteSession}
        onNewChat={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTitle('Delete Chat');
    fireEvent.click(deleteBtn);

    // Dialog should be open
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /delete chat/i })).toBeDefined();
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    expect(onDeleteSession).not.toHaveBeenCalled();
  });

  it('confirms delete and calls onDeleteSession with session id', async () => {
    const onDeleteSession = vi.fn();
    const sessions = [
      createMockSession('sess-1', { title: 'Session To Delete' }),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={onDeleteSession}
        onNewChat={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTitle('Delete Chat');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete chat/i })).toBeDefined();
    });

    // Click confirm Delete Chat button in dialog
    const confirmBtn = screen.getByRole('button', { name: /delete chat/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onDeleteSession).toHaveBeenCalledWith('sess-1');
    });
  });
});
