import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSearchInput,
  DropdownMenuEmpty,
} from './DropdownMenu';

function TestSearchableMenu({ items }: { items: string[] }) {
  const [search, setSearch] = useState('');
  const filtered = items.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <button>Open Menu</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuSearchInput
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        {filtered.map((item) => (
          <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
        ))}
        {filtered.length === 0 && (
          <DropdownMenuEmpty>No items found</DropdownMenuEmpty>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu with Overflow and Search Support', () => {
  const testItems = ['Llama 3.1 8B', 'Mistral Nemo', 'Qwen 2.5 7B', 'DeepSeek Coder'];

  it('renders content with overflow-y-auto and max-h constraint', () => {
    render(<TestSearchableMenu items={testItems} />);
    const content = screen.getByText('Llama 3.1 8B').closest('[role="menu"]');
    expect(content).toBeDefined();
    expect(content?.className).toContain('overflow-y-auto');
    expect(content?.className).toContain('custom-scrollbar');
  });

  it('filters items when typing into DropdownMenuSearchInput', () => {
    render(<TestSearchableMenu items={testItems} />);
    const searchInput = screen.getByPlaceholderText('Search items...') as HTMLInputElement;

    expect(screen.getByText('Llama 3.1 8B')).toBeDefined();
    expect(screen.getByText('Qwen 2.5 7B')).toBeDefined();

    // Type "qwen"
    fireEvent.change(searchInput, { target: { value: 'qwen' } });
    expect(screen.queryByText('Llama 3.1 8B')).toBeNull();
    expect(screen.getByText('Qwen 2.5 7B')).toBeDefined();

    // Type query with no matches
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No items found')).toBeDefined();
  });

  it('clears search input when clicking clear button', () => {
    render(<TestSearchableMenu items={testItems} />);
    const searchInput = screen.getByPlaceholderText('Search items...') as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: 'llama' } });
    expect(searchInput.value).toBe('llama');

    const clearButton = screen.getByTitle('Clear search');
    fireEvent.click(clearButton);
    expect(searchInput.value).toBe('');
    expect(screen.getByText('Mistral Nemo')).toBeDefined();
  });

  it('stops event propagation on search input to prevent Radix menu interference', () => {
    render(<TestSearchableMenu items={testItems} />);
    const searchInput = screen.getByPlaceholderText('Search items...');

    const stopPropagationSpy = vi.spyOn(Event.prototype, 'stopPropagation');
    fireEvent.keyDown(searchInput, { key: 'a' });

    expect(stopPropagationSpy).toHaveBeenCalled();
    stopPropagationSpy.mockRestore();
  });
});
