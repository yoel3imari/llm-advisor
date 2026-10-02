import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import {
  getServerState,
  chatStream,
  chatCancel,
  checkAppUpdate,
  installAppUpdate,
  type ChatStreamCallbacks,
} from './ipc/commands';

vi.mock('./ipc/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ipc/commands')>();
  return {
    ...actual,
    getServerState: vi.fn(),
    chatStream: vi.fn(),
    chatCancel: vi.fn(),
    checkAppUpdate: vi.fn(),
    installAppUpdate: vi.fn(),
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
    vi.mocked(checkAppUpdate).mockReset();
    vi.mocked(checkAppUpdate).mockResolvedValue({
      current_version: '0.2.1',
      latest_version: '0.2.1',
      update_available: false,
    });
    vi.mocked(installAppUpdate).mockReset();
    vi.mocked(installAppUpdate).mockResolvedValue(true);
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

  it('checks for new version on startup and opens update modal when update is available', async () => {
    vi.mocked(checkAppUpdate).mockResolvedValue({
      current_version: '0.2.1',
      latest_version: '0.3.0',
      update_available: true,
      release_notes: '- Multi-model routing improvements\n- Faster prompt processing',
      pub_date: '2026-10-01T12:00:00Z',
    });

    render(<App />);

    // Startup check should be executed
    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalled();
      expect(screen.getByText('New Version Available')).toBeDefined();
    });

    expect(screen.getByText('v0.2.1')).toBeDefined();
    expect(screen.getByText('v0.3.0')).toBeDefined();
    expect(screen.getByText(/- Multi-model routing improvements/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Update & Restart/i })).toBeDefined();
  });

  it('closes update modal when user clicks Dismiss', async () => {
    vi.mocked(checkAppUpdate).mockResolvedValue({
      current_version: '0.2.1',
      latest_version: '0.3.0',
      update_available: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('New Version Available')).toBeDefined();
    });

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByText('New Version Available')).toBeNull();
    });
  });

  it('triggers installAppUpdate when user clicks Update & Restart', async () => {
    vi.mocked(checkAppUpdate).mockResolvedValue({
      current_version: '0.2.1',
      latest_version: '0.3.0',
      update_available: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('New Version Available')).toBeDefined();
    });

    const updateBtn = screen.getByRole('button', { name: /Update & Restart/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(installAppUpdate).toHaveBeenCalled();
    });
  });

  it('does not open update modal when update_available is false on startup', async () => {
    vi.mocked(checkAppUpdate).mockResolvedValue({
      current_version: '0.2.1',
      latest_version: '0.2.1',
      update_available: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalled();
    });

    expect(screen.queryByText('New Version Available')).toBeNull();
  });
});
