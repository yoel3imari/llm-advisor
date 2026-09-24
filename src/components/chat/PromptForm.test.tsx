import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PromptForm } from './PromptForm';

function setup(overrides: Partial<Parameters<typeof PromptForm>[0]> = {}) {
  const onSend = vi.fn();
  const onCancel = vi.fn();
  render(
    <PromptForm onSend={onSend} onCancel={onCancel} hasModel {...overrides} />
  );
  return { onSend, onCancel };
}

describe('PromptForm', () => {
  it('sends on Enter and clears the input', () => {
    const { onSend } = setup();

    const input = screen.getByLabelText('Chat input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('Hello');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('inserts a newline on Shift+Enter without sending', () => {
    const { onSend } = setup();

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables Send when empty', () => {
    setup();
    expect(
      (screen.getByRole('button', { name: /send/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('shows Stop while streaming and cancels on click', () => {
    const { onSend, onCancel } = setup({ isSending: true });

    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables input with a model hint when no model is selected', () => {
    setup({ hasModel: false });

    const input = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toContain('Select a model');
  });

  it('shows a character counter', () => {
    setup();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'abc' },
    });
    expect(screen.getByText('3 chars')).toBeDefined();
  });
});
