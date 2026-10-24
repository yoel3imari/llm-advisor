import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TitleBar } from './TitleBar';
import { WindowResizeHandles } from './WindowResizeHandles';

describe('TitleBar', () => {
  it('renders the shared app brand and window controls', () => {
    render(<TitleBar />);

    expect(screen.getByTestId('app-titlebar')).toBeDefined();
    expect(screen.getByText('ModelSift')).toBeDefined();
    expect(screen.getByText('Local Inference')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Minimize window' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Maximize window' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close window' })).toBeDefined();
  });

  it('marks the whole bar as a deep drag region', () => {
    render(<TitleBar />);

    expect(screen.getByTestId('app-titlebar').getAttribute('data-tauri-drag-region')).toBe('deep');
  });

  it('swaps maximize for restore when the window is maximized', () => {
    render(<TitleBar isMaximized />);

    expect(screen.queryByRole('button', { name: 'Maximize window' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore window' })).toBeDefined();
  });

  it('does not throw when window controls are clicked outside Tauri', () => {
    render(<TitleBar />);

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Minimize window' }));
      fireEvent.click(screen.getByRole('button', { name: 'Maximize window' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    }).not.toThrow();
  });
});

describe('WindowResizeHandles', () => {
  it('renders nothing outside the Tauri runtime', () => {
    const { container } = render(<WindowResizeHandles />);

    expect(container.firstChild).toBeNull();
  });
});
