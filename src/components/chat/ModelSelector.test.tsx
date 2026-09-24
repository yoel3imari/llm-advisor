import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSelector } from './ModelSelector';
import { listLibraryModels, startServer } from '../../ipc/commands';
import type { ModelRecord } from '../../types/domain';

vi.mock('../../ipc/commands', () => ({
  listLibraryModels: vi.fn(),
  startServer: vi.fn(),
}));

const records: ModelRecord[] = [
  {
    entry_id: 'model-a',
    file_path: '/models/a.gguf',
    size_bytes: 1000,
    verified: true,
    added_at: '2026-01-01T00:00:00Z',
  },
  {
    entry_id: 'model-b',
    file_path: '/models/b.gguf',
    size_bytes: 2000,
    verified: true,
    added_at: '2026-01-02T00:00:00Z',
  },
];

async function openSelect() {
  await waitFor(() => {
    expect(screen.getByRole('combobox')).toBeDefined();
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox'));
  await waitFor(() => {
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
  return user;
}

describe('ModelSelector', () => {
  beforeEach(() => {
    vi.mocked(listLibraryModels).mockReset();
    vi.mocked(startServer).mockReset();
    vi.mocked(startServer).mockResolvedValue(13370);
  });

  it('lists downloaded models with a Running badge', async () => {
    vi.mocked(listLibraryModels).mockResolvedValue(records);
    render(
      <ModelSelector selectedModelId="model-a" runningModelId="model-a" onSelect={() => {}} />
    );

    await openSelect();
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
  });

  it('selects the running model immediately without starting a server', async () => {
    vi.mocked(listLibraryModels).mockResolvedValue(records);
    const onSelect = vi.fn();
    render(
      <ModelSelector selectedModelId={null} runningModelId="model-a" onSelect={onSelect} />
    );

    const user = await openSelect();
    await user.click(screen.getAllByRole('option')[0]);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('model-a');
    });
    expect(vi.mocked(startServer)).not.toHaveBeenCalled();
  });

  it('shows warming state while starting a stopped model', async () => {
    vi.mocked(listLibraryModels).mockResolvedValue(records);
    let resolveStart!: (port: number) => void;
    vi.mocked(startServer).mockImplementation(
      () => new Promise<number>((resolve) => { resolveStart = resolve; })
    );
    const onSelect = vi.fn();
    render(<ModelSelector selectedModelId={null} onSelect={onSelect} />);

    const user = await openSelect();
    await user.click(screen.getAllByRole('option')[1]);

    await waitFor(() => {
      expect(screen.getByText(/Warming up/i)).toBeDefined();
    });
    expect(onSelect).not.toHaveBeenCalled();

    resolveStart(13370);
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('model-b');
    });
    expect(screen.queryByText(/Warming up/i)).toBeNull();
  });

  it('disables the selector while streaming', async () => {
    vi.mocked(listLibraryModels).mockResolvedValue(records);
    render(
      <ModelSelector selectedModelId="model-a" onSelect={() => {}} isStreaming />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDefined();
    });
    expect(
      (screen.getByRole('combobox') as HTMLElement).getAttribute('data-disabled')
    ).not.toBeNull();
  });

  it('shows an empty-library hint when nothing is downloaded', async () => {
    vi.mocked(listLibraryModels).mockResolvedValue([]);
    render(<ModelSelector selectedModelId={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/No downloaded models/i)).toBeDefined();
    });
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
