import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('Local LLM Advisor App UI', () => {
  it('renders app shell with navigation sidebar and unified dashboard', async () => {
    render(<App />);
    expect(screen.getByText('Local LLM Advisor')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Library')).toBeDefined();
    expect(screen.getByText('Server Control')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    // Verify Dashboard contains specs and unified models table
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
      expect(screen.getByText(/Context Size:/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Search by model name/i)).toBeDefined();
    });
  });

  it('switches views when clicking sidebar tabs', async () => {
    render(<App />);

    // Click Library
    fireEvent.click(screen.getByText('Library'));
    await waitFor(() => {
      expect(screen.getByText('Model Library & Downloads')).toBeDefined();
    });

    // Click Server Control
    fireEvent.click(screen.getByText('Server Control'));
    await waitFor(() => {
      expect(screen.getByText('Inference Server Control')).toBeDefined();
    });

    // Click Settings
    fireEvent.click(screen.getByText('Settings'));
    await waitFor(() => {
      expect(screen.getByText('Application Settings')).toBeDefined();
    });

    // Click Dashboard
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
    });
  });
});
