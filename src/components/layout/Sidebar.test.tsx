import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar, type NavTab } from './Sidebar';
import { TooltipProvider } from '../ui/Tooltip';
import type { DownloadTask, ServerState } from '../../types/domain';

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const defaultProps = {
    activeTab: 'chat' as NavTab,
    onSelectTab: vi.fn(),
    serverState: { state: 'stopped' as const },
    activeDownloads: [] as DownloadTask[],
    ...props,
  };

  return {
    ...render(
      <TooltipProvider>
        <Sidebar {...defaultProps} />
      </TooltipProvider>
    ),
    props: defaultProps,
  };
}

describe('Sidebar Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders expanded by default with brand title and all nav labels', () => {
    renderSidebar();

    const sidebar = screen.getByTestId('main-sidebar');
    expect(sidebar.getAttribute('data-collapsed')).toBe('false');
    expect(sidebar.className).toContain('w-64');

    expect(screen.getByText('LLM Advisor')).toBeDefined();
    expect(screen.getByText('HARDWARE INFERENCE')).toBeDefined();
    expect(screen.getByText('Chat')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Library')).toBeDefined();
    expect(screen.getByText('Server Control')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Daemon')).toBeDefined();
  });

  it('toggles to collapsed mode when clicking the collapse button', () => {
    renderSidebar();

    const toggleBtn = screen.getByTestId('main-sidebar-toggle');
    expect(toggleBtn.getAttribute('aria-label')).toBe('Collapse sidebar');

    fireEvent.click(toggleBtn);

    const sidebar = screen.getByTestId('main-sidebar');
    expect(sidebar.getAttribute('data-collapsed')).toBe('true');
    expect(sidebar.className).toContain('w-16');

    // Title and text labels should have collapsed styles and be aria-hidden
    const titleContainer = screen.getByText('LLM Advisor').parentElement;
    expect(titleContainer?.getAttribute('aria-hidden')).toBe('true');
    expect(titleContainer?.className).toContain('max-w-0');
    expect(titleContainer?.className).toContain('opacity-0');

    // Logo image is still present
    const logoImg = screen.getByAltText('LLM Advisor');
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/app-icon.png');

    // All nav buttons exist via accessible aria-labels
    expect(screen.getByRole('button', { name: 'Chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Library' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Server Control' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  });

  it('toggles back to expanded mode when clicking the expand button in collapsed state', () => {
    renderSidebar();

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));
    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('true');

    // Expand
    const expandBtn = screen.getByTestId('main-sidebar-toggle');
    expect(expandBtn.getAttribute('aria-label')).toBe('Expand sidebar');
    fireEvent.click(expandBtn);

    const sidebar = screen.getByTestId('main-sidebar');
    expect(sidebar.getAttribute('data-collapsed')).toBe('false');
    expect(screen.getByText('LLM Advisor')).toBeDefined();
  });

  it('clicking logo in collapsed mode expands the sidebar', () => {
    renderSidebar();

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));
    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('true');

    // Click logo button
    const logoBtn = screen.getByTestId('main-sidebar-logo');
    fireEvent.click(logoBtn);

    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('false');
    expect(screen.getByText('LLM Advisor')).toBeDefined();
  });

  it('calls onSelectTab when clicking nav items in collapsed mode', () => {
    const onSelectTab = vi.fn();
    renderSidebar({ onSelectTab });

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));

    // Click Dashboard icon
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onSelectTab).toHaveBeenCalledWith('dashboard');

    // Click Library icon
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(onSelectTab).toHaveBeenCalledWith('library');
  });

  it('displays badge and active downloads in collapsed mode', () => {
    const dummyDownloads: DownloadTask[] = [
      {
        entry_id: 'qwen2.5-0.5b',
        bytes_done: 50000000,
        bytes_total: 100000000,
        etag: 'mock-etag',
        state: { status: 'downloading', bytes_done: 50000000, total_bytes: 100000000 },
      },
    ];

    renderSidebar({ activeDownloads: dummyDownloads });

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));

    // Should have active downloads progress circle in bottom dock
    const dlBtn = screen.getByRole('button', { name: 'Active downloads' });
    expect(dlBtn).toBeDefined();
    expect(dlBtn.textContent).toContain('1');
    expect(dlBtn.textContent).toContain('50%');
  });

  it('displays ON indicator when server state is serving in collapsed mode', () => {
    const servingState: ServerState = {
      state: 'serving',
      model_id: 'qwen2.5-0.5b',
      model_path: '/path/to/model.gguf',
      port: 13370,
      context_size: 4096,
      started_at: '2026-01-01T00:00:00Z',
    };

    renderSidebar({ serverState: servingState });

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));

    const serverNavBtn = screen.getByRole('button', { name: 'Server Control' });
    expect(serverNavBtn).toBeDefined();

    const daemonBtn = screen.getByRole('button', { name: 'Daemon: serving' });
    expect(daemonBtn).toBeDefined();
  });

  it('respects controlled isCollapsed and onToggleCollapse props', () => {
    const onToggle = vi.fn();
    renderSidebar({ isCollapsed: true, onToggleCollapse: onToggle });

    const sidebar = screen.getByTestId('main-sidebar');
    expect(sidebar.getAttribute('data-collapsed')).toBe('true');

    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggles using Cmd+B / Ctrl+B keyboard shortcut when not typing in input', () => {
    renderSidebar();

    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('false');

    // Trigger Cmd+B
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    });

    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('true');

    // Trigger Ctrl+B to expand back
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    });

    expect(screen.getByTestId('main-sidebar').getAttribute('data-collapsed')).toBe('false');
  });

  it('persists collapsed state to localStorage', () => {
    renderSidebar();

    // Initially not collapsed in localStorage
    expect(localStorage.getItem('llm-advisor-sidebar-collapsed')).toBeNull();

    // Collapse
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));
    expect(localStorage.getItem('llm-advisor-sidebar-collapsed')).toBe('true');

    // Expand
    fireEvent.click(screen.getByTestId('main-sidebar-toggle'));
    expect(localStorage.getItem('llm-advisor-sidebar-collapsed')).toBe('false');
  });
});
