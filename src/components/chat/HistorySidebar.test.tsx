import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders a list of sessions showing title only (without snippet or model ID)', () => {
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
    expect(screen.queryByText('llama-3-8b')).toBeNull();
    expect(screen.queryByText('qwen-2.5-7b')).toBeNull();
    expect(screen.queryByText(/First message of session sess-1/)).toBeNull();
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

  it('turns delete button red on first click without deleting', () => {
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
    expect(deleteBtn.className).not.toContain('bg-rose-600');

    // First click arms confirmation and turns button red
    fireEvent.click(deleteBtn);

    expect(deleteBtn.className).toContain('bg-rose-600');
    expect(onDeleteSession).not.toHaveBeenCalled();
  });

  it('confirms delete on second click and calls onDeleteSession with session id', () => {
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

    // First click: turns button red
    fireEvent.click(deleteBtn);
    expect(deleteBtn.className).toContain('bg-rose-600');
    expect(onDeleteSession).not.toHaveBeenCalled();

    // Second click: performs delete
    fireEvent.click(deleteBtn);
    expect(onDeleteSession).toHaveBeenCalledWith('sess-1');
  });

  it('cancels delete confirmation if clicking session item or pressing Escape', () => {
    const onDeleteSession = vi.fn();
    const onSelectSession = vi.fn();
    const sessions = [
      createMockSession('sess-1', { title: 'Session 1' }),
      createMockSession('sess-2', { title: 'Session 2' }),
    ];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onNewChat={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTestId('delete-session-sess-1');

    // First click turns red
    fireEvent.click(deleteBtn);
    expect(deleteBtn.className).toContain('bg-rose-600');

    // Press Escape -> resets
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(deleteBtn.className).not.toContain('bg-rose-600');
    expect(onDeleteSession).not.toHaveBeenCalled();

    // Click 1 turns red again
    fireEvent.click(deleteBtn);
    expect(deleteBtn.className).toContain('bg-rose-600');

    // Clicking session row cancels confirmation and selects session
    fireEvent.click(screen.getByText('Session 1'));
    expect(deleteBtn.className).not.toContain('bg-rose-600');
    expect(onSelectSession).toHaveBeenCalledWith('sess-1');
    expect(onDeleteSession).not.toHaveBeenCalled();
  });

  it('allows renaming a session via inline input', () => {
    const onRenameSession = vi.fn();
    const sessions = [createMockSession('sess-1', { title: 'Old Title' })];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
        onRenameSession={onRenameSession}
      />
    );

    const renameBtn = screen.getByTestId('rename-session-sess-1');
    fireEvent.click(renameBtn);

    const input = screen.getByTestId('rename-input-sess-1') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('Old Title');

    fireEvent.change(input, { target: { value: 'New Custom Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameSession).toHaveBeenCalledWith('sess-1', 'New Custom Title');
  });

  it('cancels renaming when pressing Escape', () => {
    const onRenameSession = vi.fn();
    const sessions = [createMockSession('sess-1', { title: 'Old Title' })];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
        onRenameSession={onRenameSession}
      />
    );

    const renameBtn = screen.getByTestId('rename-session-sess-1');
    fireEvent.click(renameBtn);

    const input = screen.getByTestId('rename-input-sess-1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Discarded Title' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRenameSession).not.toHaveBeenCalled();
    expect(screen.getByText('Old Title')).toBeDefined();
  });

  it('calls onRegenerateTitle when clicking the regenerate title button', () => {
    const onRegenerateTitle = vi.fn();
    const sessions = [createMockSession('sess-1', { title: 'Old Title' })];

    render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
        onRegenerateTitle={onRegenerateTitle}
      />
    );

    const regenBtn = screen.getByTestId('regenerate-title-sess-1');
    fireEvent.click(regenBtn);

    expect(onRegenerateTitle).toHaveBeenCalledWith('sess-1');
  });

  it('shows loading animation when regenerating title', () => {
    const sessions = [createMockSession('sess-1', { title: 'Old Title' })];

    const { container } = render(
      <HistorySidebar
        sessions={sessions}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onNewChat={vi.fn()}
        onRegenerateTitle={vi.fn()}
        regeneratingSessionId="sess-1"
      />
    );

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });
});
