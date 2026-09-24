import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('LLM Advisor App UI', () => {
  it('renders app shell with navigation sidebar and chat as default view', async () => {
    render(<App />);
    expect(screen.getByText('LLM Advisor')).toBeDefined();
    expect(screen.getAllByText('Chat').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Library')).toBeDefined();
    expect(screen.getByText('Server Control')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    // Chat is the default main view
    expect(screen.getByText(/Start a conversation/i)).toBeDefined();

    // Dashboard view is still reachable
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Dashboard & Recommendations')).toBeDefined();
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
