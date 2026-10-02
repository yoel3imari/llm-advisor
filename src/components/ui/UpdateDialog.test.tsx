import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpdateDialog } from './UpdateDialog';
import type { AppUpdateInfo } from '../../types/domain';

const mockUpdateInfo: AppUpdateInfo = {
  current_version: '0.2.0',
  latest_version: '0.3.0',
  update_available: true,
  release_notes: '- Added new version modal\n- Improved sidecar performance',
  pub_date: '2026-10-01T12:00:00Z',
};

describe('UpdateDialog UI Component', () => {
  it('renders modal with version details and release notes when open', () => {
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('New Version Available')).toBeDefined();
    expect(screen.getByText('v0.2.0')).toBeDefined();
    expect(screen.getByText('v0.3.0')).toBeDefined();
    expect(screen.getByText('Release Notes')).toBeDefined();
    expect(screen.getByText(/- Added new version modal/)).toBeDefined();
    expect(screen.getByText('Dismiss')).toBeDefined();
    expect(screen.getByText('Update & Restart')).toBeDefined();
  });

  it('does not render content when open is false', () => {
    const onOpenChange = vi.fn();
    render(
      <UpdateDialog
        open={false}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
      />
    );

    expect(screen.queryByText('New Version Available')).toBeNull();
  });

  it('does not render content when updateInfo is null', () => {
    const onOpenChange = vi.fn();
    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={null}
      />
    );

    expect(screen.queryByText('New Version Available')).toBeNull();
  });

  it('triggers onDismiss and closes on clicking Dismiss button', () => {
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('triggers onDismiss and closes on clicking the close X button', () => {
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
        onDismiss={onDismiss}
      />
    );

    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('handles Update & Restart click and shows loading state', async () => {
    const onOpenChange = vi.fn();
    let resolveUpdate: () => void = () => {};
    const updatePromise = new Promise<void>((res) => {
      resolveUpdate = res;
    });
    const onUpdateAndRestart = vi.fn().mockReturnValue(updatePromise);

    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
        onUpdateAndRestart={onUpdateAndRestart}
      />
    );

    const updateButton = screen.getByRole('button', { name: /Update & Restart/i });
    fireEvent.click(updateButton);

    expect(onUpdateAndRestart).toHaveBeenCalled();

    // Verify loading state is shown and dismiss is disabled
    expect(screen.getByText('Updating & Restarting...')).toBeDefined();
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissButton.getAttribute('disabled')).not.toBeNull();

    // Resolve update
    resolveUpdate();
    await waitFor(() => {
      expect(screen.getByText('Restarting...')).toBeDefined();
    });
  });

  it('displays error notice when update fails', async () => {
    const onOpenChange = vi.fn();
    const onUpdateAndRestart = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    render(
      <UpdateDialog
        open={true}
        onOpenChange={onOpenChange}
        updateInfo={mockUpdateInfo}
        onUpdateAndRestart={onUpdateAndRestart}
      />
    );

    const updateButton = screen.getByRole('button', { name: /Update & Restart/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText(/Update failed: Error: Network connection timeout/)).toBeDefined();
    });

    // Dismiss should be re-enabled after failure
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissButton.getAttribute('disabled')).toBeNull();
  });
});
