import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('shadcn Input Component', () => {
  it('renders correctly with default and custom styling', () => {
    render(<Input placeholder="Enter prompt..." className="custom-test-class" />);
    const input = screen.getByPlaceholderText('Enter prompt...');
    expect(input).toBeDefined();
    expect(input.className).toContain('custom-test-class');
    expect(input.className).toContain('bg-zinc-950');
  });

  it('forwards ref properly', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="llama-3" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe('llama-3');
  });

  it('handles input events and disabled state', () => {
    const handleChange = vi.fn();
    const { rerender } = render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'q4_k_m' } });
    expect(handleChange).toHaveBeenCalled();

    rerender(<Input disabled />);
    expect(input.disabled).toBe(true);
  });
});
