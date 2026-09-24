import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';
import { Textarea } from './Textarea';
import { Avatar, AvatarFallback } from './Avatar';
import { ScrollArea } from './ScrollArea';
import { Separator } from './Separator';
import { Badge } from './Badge';

describe('new shadcn primitives', () => {
  it('renders Button variants', () => {
    render(<Button>Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('renders Textarea with placeholder', () => {
    render(<Textarea placeholder="Type a message" />);
    expect(screen.getByPlaceholderText('Type a message')).toBeDefined();
  });

  it('renders Avatar with fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('AI')).toBeDefined();
  });

  it('renders ScrollArea content', () => {
    render(
      <ScrollArea>
        <div>scrollable content</div>
      </ScrollArea>
    );
    expect(screen.getByText('scrollable content')).toBeDefined();
  });

  it('renders Separator and Badge', () => {
    const { container } = render(
      <div>
        <Separator />
        <Badge>Running</Badge>
      </div>
    );
    expect(screen.getByText('Running')).toBeDefined();
    expect(container.querySelector('[data-orientation]')).not.toBeNull();
  });
});
