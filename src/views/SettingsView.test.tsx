import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsView } from './SettingsView';

describe('SettingsView UI & Automated Uninstaller', () => {
  it('renders all settings sections and controls', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Application Settings')).toBeDefined();
      expect(screen.getByText('Background Execution & System Tray')).toBeDefined();
      expect(screen.getByText('Inference & Serving Defaults')).toBeDefined();
      expect(screen.getByText('Hugging Face Access Token')).toBeDefined();
      expect(screen.getByText('OpenAI-Compatible Gateway Network')).toBeDefined();
      expect(screen.getByText('Open-Source Catalog & CDN Updates')).toBeDefined();
      expect(screen.getByText('Application Updates & Version')).toBeDefined();
      expect(screen.getByText('Models Storage Directory & Reclaim')).toBeDefined();
      expect(screen.getByText('Automated Application Uninstaller & Cleaner')).toBeDefined();
    });
  });

  it('renders shadcn Checkbox and toggles background execution setting', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(
        screen.getByText('Keep inference server and gateway running when main window is closed')
      ).toBeDefined();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    const bgCheckbox = checkboxes[0];

    // Toggle checkbox
    fireEvent.click(bgCheckbox);
    expect(bgCheckbox.getAttribute('data-state')).toBe('unchecked');

    fireEvent.click(bgCheckbox);
    expect(bgCheckbox.getAttribute('data-state')).toBe('checked');
  });

  it('triggers manual catalog update sync', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Check for Updates Now')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Check for Updates Now'));

    await waitFor(() => {
      expect(
        screen.getByText(/Model catalog updated!|Catalog is already up to date/)
      ).toBeDefined();
    });
  });

  it('checks for native application updates', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Check for App Updates')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Check for App Updates'));

    await waitFor(() => {
      expect(screen.getByText(/LLM Advisor is up to date/)).toBeDefined();
    });
  });

  it('opens automated uninstaller dialog and completes deep clean', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Launch Automated Cleaner')).toBeDefined();
    });

    // Open uninstaller dialog
    fireEvent.click(screen.getByText('Launch Automated Cleaner'));

    await waitFor(() => {
      expect(screen.getByText('Automated Uninstaller & Deep Cleaner')).toBeDefined();
      expect(screen.getByText('Execute Automated Deep Clean')).toBeDefined();
    });

    // Execute automated clean
    fireEvent.click(screen.getByText('Execute Automated Deep Clean'));

    // Verify completion screen
    await waitFor(
      () => {
        expect(
          screen.getByText('Clean Uninstall Completed Successfully!')
        ).toBeDefined();
        expect(screen.getByText('Disk Space Reclaimed')).toBeDefined();
      },
      { timeout: 5000 }
    );
  });

  it('saves preferences and displays save confirmation banner', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully.')).toBeDefined();
    });
  });
});
