import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatErrors } from './ChatErrors';

describe('ChatErrors Component', () => {
  it('renders nothing when no error and no context warning', () => {
    const { container } = render(<ChatErrors error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders NO_MODEL error with Start Model CTA', () => {
    const onStartModel = vi.fn();
    render(
      <ChatErrors
        error={{ code: 'NO_MODEL', message: 'No model serving' }}
        onStartModel={onStartModel}
      />
    );

    expect(screen.getByText(/no model serving/i)).toBeDefined();
    const btn = screen.getByRole('button', { name: /start model/i });
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(onStartModel).toHaveBeenCalledTimes(1);
  });

  it('renders SIDECAR_DIED error with Regenerate CTA', () => {
    const onRegenerate = vi.fn();
    render(
      <ChatErrors
        error={{ code: 'SIDECAR_DIED', message: 'Sidecar process crashed' }}
        onRegenerate={onRegenerate}
      />
    );

    expect(screen.getByText(/inference server stopped/i)).toBeDefined();
    const btn = screen.getByRole('button', { name: /regenerate/i });
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('renders TIMEOUT error with Continue CTA', () => {
    const onContinue = vi.fn();
    render(
      <ChatErrors
        error={{ code: 'TIMEOUT', message: 'No tokens received' }}
        onContinue={onContinue}
      />
    );

    expect(screen.getByText(/timed out/i)).toBeDefined();
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('renders 80% context warning banner', () => {
    render(<ChatErrors error={null} contextWarning={true} contextCritical={false} />);
    expect(screen.getByText(/context window is 80% full/i)).toBeDefined();
  });

  it('renders 95% critical context truncation notice', () => {
    render(
      <ChatErrors
        error={null}
        contextWarning={true}
        contextCritical={true}
        contextTruncatedCount={2}
      />
    );
    expect(screen.getByText(/context limit exceeded/i)).toBeDefined();
    expect(screen.getByText(/2 older message/i)).toBeDefined();
  });
});
