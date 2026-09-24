import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ParamsPanel } from './ParamsPanel';
import { defaultParams } from '../../types/chat';

function setup() {
  const onChange = vi.fn();
  render(<ParamsPanel params={defaultParams()} onChange={onChange} />);
  return { onChange };
}

async function openPanel() {
  await userEvent.setup().click(
    screen.getByRole('button', { name: /toggle parameters panel/i })
  );
  await waitFor(() => {
    expect(screen.getByLabelText(/system prompt/i)).toBeDefined();
  });
}

describe('ParamsPanel', () => {
  it('toggles open and updates temperature via slider', async () => {
    const { onChange } = setup();
    await openPanel();

    const slider = screen.getByRole('slider');
    slider.focus();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.temperature).toBeGreaterThan(0.7);
  });

  it('updates context size via select', async () => {
    const { onChange } = setup();
    await openPanel();

    await userEvent.setup().click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    });
    await userEvent.setup().click(screen.getByText('8,192'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 8192 })
    );
  });

  it('updates max tokens via input', async () => {
    const { onChange } = setup();
    await openPanel();

    fireEvent.change(screen.getByLabelText(/max tokens/i), {
      target: { value: '1024' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 1024 })
    );
  });

  it('truncates over-limit system prompts with a red counter', async () => {
    const { onChange } = setup();
    await openPanel();

    fireEvent.change(screen.getByLabelText(/system prompt/i), {
      target: { value: 'x'.repeat(9000) },
    });

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.systemPrompt).toHaveLength(8000);
  });

  it('shows a red counter at the limit', async () => {
    const over = { ...defaultParams(), systemPrompt: 'x'.repeat(8000) };
    const onChange = vi.fn();
    render(<ParamsPanel params={over} onChange={onChange} />);
    await openPanel();

    const counter = screen.getByText('8000 / 8000');
    expect(counter.className).toContain('text-red-400');
  });
});
