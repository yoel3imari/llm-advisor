import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageBubble, MessageList } from './MessageBubble';
import { newMessage } from '../../types/chat';

describe('MessageBubble', () => {
  it('aligns user messages to the end', () => {
    const { container } = render(
      <MessageBubble message={newMessage('user', 'Hello')} />
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain('justify-end');
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('aligns assistant messages to the start with avatar', () => {
    const { container } = render(
      <MessageBubble message={newMessage('assistant', 'Hi there')} />
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain('justify-start');
    expect(screen.getByText('AI')).toBeDefined();
    expect(screen.getByText('Hi there')).toBeDefined();
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
});
