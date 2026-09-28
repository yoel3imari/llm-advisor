import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBubble, MessageList, CopyMessageButton } from './MessageBubble';
import { newMessage } from '../../types/chat';

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aligns user messages to the end with standing out bg and no avatar', () => {
    const { container } = render(
      <MessageBubble message={newMessage('user', 'Hello')} />
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain('justify-end');
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.queryByText('You')).toBeNull();
    const bubble = container.querySelector('[data-testid="message-user"] > div');
    expect(bubble?.className).toContain('bg-zinc-800');
  });

  it('aligns assistant messages to the start without avatar and with transparent bg', () => {
    const { container } = render(
      <MessageBubble message={newMessage('assistant', 'Hi there')} />
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain('justify-start');
    expect(screen.queryByText('AI')).toBeNull();
    expect(screen.getByText('Hi there')).toBeDefined();
    const bubble = container.querySelector('[data-testid="message-assistant"] > div');
    expect(bubble?.className).toContain('bg-transparent');
  });

  it('renders markdown tables and code with copy button', () => {
    render(
      <MessageBubble
        message={newMessage(
          'assistant',
          '| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n```'
        )}
      />
    );
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('const a = 1;')).toBeDefined();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeDefined();
  });

  it('does not execute embedded scripts', () => {
    const { container } = render(
      <MessageBubble message={newMessage('assistant', '<script>alert(1)</script>')} />
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('shows streaming shimmer on the active assistant bubble', () => {
    const msg = newMessage('assistant', 'partial');
    const { container } = render(<MessageBubble message={msg} streaming />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('lists messages in a polite live region', () => {
    render(
      <MessageList
        messages={[newMessage('user', 'one'), newMessage('assistant', 'two')]}
      />
    );
    const log = screen.getByRole('log');
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('one')).toBeDefined();
    expect(screen.getByText('two')).toBeDefined();
  });

  it('renders copy button under user messages and copies text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<MessageBubble message={newMessage('user', 'What is quantization?')} />);

    const copyBtn = screen.getByRole('button', { name: /copy message/i });
    expect(copyBtn).toBeDefined();
    expect(copyBtn.getAttribute('data-testid')).toBe('copy-message-btn');

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith('What is quantization?');
    expect(screen.getByRole('button', { name: /copied/i })).toBeDefined();
    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('renders copy button under assistant messages and copies content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <MessageBubble
        message={newMessage('assistant', 'Quantization reduces model weight precision.')}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy message/i });
    expect(copyBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith(
      'Quantization reduces model weight precision.'
    );
    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('hides copy button while message is streaming', () => {
    render(
      <MessageBubble
        message={newMessage('assistant', 'Generating answer...')}
        streaming={true}
      />
    );

    expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();
    expect(screen.queryByTestId('copy-message-btn')).toBeNull();
  });

  it('hides copy button when message content is empty', () => {
    render(
      <MessageBubble
        message={newMessage('assistant', '')}
        streaming={false}
      />
    );

    expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();
  });

  it('uses fallback execCommand copy when navigator.clipboard fails', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execMock = vi.fn().mockReturnValue(true);
    document.execCommand = execMock;

    render(<CopyMessageButton content="Fallback copy text" />);

    const btn = screen.getByRole('button', { name: /copy message/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(execMock).toHaveBeenCalledWith('copy');
    expect(screen.getByText('Copied!')).toBeDefined();
  });
});
