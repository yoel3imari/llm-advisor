import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import {
  getServerState,
  chatStream,
  chatCancel,
  type ChatStreamCallbacks,
} from './ipc/commands';

vi.mock('./ipc/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ipc/commands')>();
  return {
    ...actual,
    getServerState: vi.fn(),
    chatStream: vi.fn(),
    chatCancel: vi.fn(),
  };
});

describe('LLM Advisor App UI', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getServerState).mockReset();
    vi.mocked(getServerState).mockResolvedValue({ state: 'stopped' });
    vi.mocked(chatStream).mockReset();
    vi.mocked(chatCancel).mockReset();
    vi.mocked(chatCancel).mockResolvedValue(undefined);
  });

  it('renders app shell with navigation sidebar and chat as default view', async () => {
    render(<App />);
    expect(screen.getByText('LLM Advisor')).toBeDefined();
    expect(screen.getAllByText('Chat').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Library')).toBeDefined();
    expect(screen.getByText('Server Control')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    // Chat is the default main view
    expect(screen.getByText(/Start a conversation/i)).toBeDefined();

    // Dashboard view is still reachable
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
    });
  });

  it('switches views when clicking sidebar tabs', async () => {
    render(<App />);

    // Click Library
    fireEvent.click(screen.getByText('Library'));
    await waitFor(() => {
      expect(screen.getByText('Model Library & Downloads')).toBeDefined();
    });

    // Click Server Control
    fireEvent.click(screen.getByText('Server Control'));
    await waitFor(() => {
      expect(screen.getByText('Inference Server Control')).toBeDefined();
    });

    // Click Settings
    fireEvent.click(screen.getByText('Settings'));
    await waitFor(() => {
      expect(screen.getByText('Application Settings')).toBeDefined();
    });

    // Click Dashboard
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
    });
  });

  it('preserves chat streaming when switching to another tab and returning to chat', async () => {
    vi.mocked(getServerState).mockResolvedValue({
      state: 'serving',
      model_id: 'qwen2.5-0.5b',
      model_path: '/path/to/qwen.gguf',
      port: 13370,
      context_size: 4096,
      started_at: '2026-01-01T00:00:00Z',
    });

    let streamCallbacks: ChatStreamCallbacks | undefined;
    vi.mocked(chatStream).mockImplementation(async (_request, callbacks) => {
      streamCallbacks = callbacks;
      return 'sess-stream-tab-switch';
    });

    render(<App />);

    // Wait for the serving model to enable the chat input
    const input = (await screen.findByLabelText('Chat input')) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(input.disabled).toBe(false);
    });

    // Send a user prompt
    fireEvent.change(input, { target: { value: 'Explain quantum computing' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    // Initial tokens start arriving
    act(() => {
      streamCallbacks?.onToken('Quantum computing uses qubits ');
    });
    expect(screen.getByText(/Quantum computing uses qubits/)).toBeDefined();

    // User switches to Dashboard tab
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
    });

    // Verify chatCancel was NOT called upon switching tabs
    expect(chatCancel).not.toHaveBeenCalled();

    // While on Dashboard, the model continues generating tokens in background
    act(() => {
      streamCallbacks?.onToken('to perform calculations in parallel.');
      streamCallbacks?.onDone();
    });

    // User returns to Chat tab
    const chatTabBtn = screen.getAllByRole('button', { name: /chat/i })[0];
    fireEvent.click(chatTabBtn);

    // Verify chatCancel was still never called and the full response is preserved
    expect(chatCancel).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Quantum computing uses qubits to perform calculations in parallel\./)
    ).toBeDefined();
  });
});
