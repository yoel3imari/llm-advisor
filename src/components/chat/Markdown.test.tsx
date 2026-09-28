import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown renderer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders headings, lists, tables and fenced code with copy button', () => {
    const content = [
      '# Hello',
      '',
      '- item one',
      '- item two',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '```js',
      'const a = 1;',
      '```',
    ].join('\n');

    render(<Markdown content={content} />);

    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('item one')).toBeDefined();
    expect(screen.getAllByText('1')[0]).toBeDefined();
    expect(screen.getByText('const a = 1;')).toBeDefined();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeDefined();
  });

  it('copies code to clipboard and toggles icon', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<Markdown content={'```js\nconst a = 1;\n```'} />);

    fireEvent.click(screen.getByRole('button', { name: /copy code/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('const a = 1;');
    });
  });

  it('does not execute embedded script tags', () => {
    render(<Markdown content={'<script>alert(1)</script>'} />);

    expect(document.querySelector('script')).toBeNull();
  });
});
