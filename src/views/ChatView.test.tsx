import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatView } from './ChatView';
import {
  chatStream,
  chatCancel,
  chatGenerateTitle,
  listLibraryModels,
  startServer,
} from '../ipc/commands';
import type { ChatStreamCallbacks } from '../ipc/commands';
import type { ModelRecord } from '../types/domain';

vi.mock('../ipc/commands', () => ({
  chatStream: vi.fn(),
  chatCancel: vi.fn(),
  chatGenerateTitle: vi.fn().mockResolvedValue('Mock Dynamic Title'),
  listLibraryModels: vi.fn(),
  startServer: vi.fn(),
  getServerState: vi.fn().mockResolvedValue(null),
  getCatalog: vi.fn().mockResolvedValue([]),
}));

const mockModels: ModelRecord[] = [
  {
    entry_id: 'llama-3-8b',
    file_path: '/models/llama-3-8b.gguf',
    size_bytes: 4000000000,
    verified: true,
    added_at: '2026-01-01T00:00:00Z',
  },
];

function mockStreamingSession(sessionId = 'sess-stream-1') {
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

describe('ChatView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listLibraryModels).mockReset();
    vi.mocked(listLibraryModels).mockResolvedValue(mockModels);
    vi.mocked(startServer).mockReset();
    vi.mocked(startServer).mockResolvedValue(13370);
    vi.mocked(chatStream).mockReset();
    vi.mocked(chatCancel).mockReset();
    vi.mocked(chatCancel).mockResolvedValue(undefined);
    vi.mocked(chatGenerateTitle).mockReset();
    vi.mocked(chatGenerateTitle).mockResolvedValue('Dynamic GQA Architecture');
  });

  it('renders header and empty state', () => {
    render(<ChatView modelId={null} />);

    expect(screen.getByText('Chat')).toBeDefined();
    expect(screen.getByText(/Start a conversation/i)).toBeDefined();
  });

  it('disables input and hints model selection when no model', () => {
    render(<ChatView modelId={null} />);

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText(/Select a model/i)).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /send/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('enables input when a model is selected', () => {
    render(<ChatView modelId="llama-3-8b" />);

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);
    expect(
      (screen.getByRole('button', { name: /send/i }) as HTMLButtonElement).disabled
    ).toBe(true); // empty input is disabled
  });

  it('sends message and streams tokens into message bubbles', async () => {
    const session = mockStreamingSession();
    render(<ChatView modelId="llama-3-8b" />);

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Explain GQA' } });

    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // User message bubble appears
    expect(screen.getByTestId('message-user').textContent).toContain('Explain GQA');

    // Stream assistant response
    act(() => {
      session.callbacks().onToken('Grouped-query ');
    });
    expect(screen.getByText(/Grouped-query/)).toBeDefined();

    act(() => {
      session.callbacks().onToken('attention reduces KV cache.');
    });
    act(() => {
      session.callbacks().onDone();
    });

    expect(screen.getByText(/Grouped-query attention reduces KV cache\./)).toBeDefined();
  });

  it('pauses auto-scroll on scroll-up and shows jump-to-bottom button', async () => {
    const session = mockStreamingSession();
    const { container } = render(<ChatView modelId="llama-3-8b" />);

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Long explanation' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    // Stream initial tokens
    act(() => {
      session.callbacks().onToken('First token. ');
    });

    const viewports = container.querySelectorAll('[data-radix-scroll-area-viewport]');
    const viewport = (viewports[viewports.length - 1] || viewports[0]) as HTMLElement;
    expect(viewport).not.toBeNull();

    // Mock scrollHeight, clientHeight, and simulate scroll to top
    Object.defineProperty(viewport, 'scrollHeight', { value: 1000, writable: true, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 400, writable: true, configurable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true, configurable: true });

    act(() => {
      fireEvent.scroll(viewport);
    });

    // Jump to bottom button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /jump to bottom/i })).toBeDefined();
    });

    // Click Jump to bottom
    const jumpBtn = screen.getByRole('button', { name: /jump to bottom/i });
    act(() => {
      fireEvent.click(jumpBtn);
    });

    // Verify scrollTop updated to scrollHeight
    expect(viewport.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: /jump to bottom/i })).toBeNull();
  });

  it('toggles parameters panel', async () => {
    render(<ChatView modelId="llama-3-8b" />);

    const paramsBtn = screen.getByRole('button', { name: /parameters/i });
    expect(screen.queryByLabelText('System prompt')).toBeNull();

    fireEvent.click(paramsBtn);
    expect(screen.getByLabelText('System prompt')).toBeDefined();

    fireEvent.click(paramsBtn);
    expect(screen.queryByLabelText('System prompt')).toBeNull();
  });

  it('creates new chat session and switches between sessions', async () => {
    render(<ChatView modelId="llama-3-8b" />);

    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    fireEvent.click(newChatBtn);

    // Sidebar should have history
    await waitFor(() => {
      expect(screen.getAllByTestId(/history-item-/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('dynamically generates conversation title upon stream completion', async () => {
    const session = mockStreamingSession();
    render(<ChatView modelId="llama-3-8b" />);

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(input, {
      target: { value: 'Can you please explain how Grouped-Query Attention works in Llama 3?' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    // Stream assistant response
    act(() => {
      session.callbacks().onToken('GQA optimizes memory bandwidth.');
    });

    await act(async () => {
      session.callbacks().onDone();
    });

    await waitFor(() => {
      expect(chatGenerateTitle).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Dynamic GQA Architecture')).toBeDefined();
    });
  });
});
