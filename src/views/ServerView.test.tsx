import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ServerView } from './ServerView';
import type { ServerState, ModelRecord } from '../types/domain';

const mockLibraryRecords: ModelRecord[] = [
  {
    entry_id: 'llama-3.1-8b-instruct-q4_k_m',
    file_path: '/models/llama-3.1-8b-instruct-q4_k_m.gguf',
    size_bytes: 4920727040,
    added_at: '2026-08-30T12:00:00Z',
    verified: true,
  },
];

describe('ServerView UI & Error Handling', () => {
  it('renders server control panel and controls', async () => {
    const serverState: ServerState = { state: 'stopped' };

    render(
      <ServerView
        serverState={serverState}
        libraryRecords={mockLibraryRecords}
        onRefreshState={() => {}}
      />
    );

    expect(screen.getByText('Inference Server Control')).toBeDefined();
    expect(screen.getByText('Model to Launch')).toBeDefined();
    expect(screen.getByText('Context Window')).toBeDefined();
    expect(screen.getByText('KV Quant')).toBeDefined();
    expect(screen.getByText('Instance Logs')).toBeDefined();
  });

  it('renders error state with unwrapped error content (whitespace-nowrap) without squeezing layout', async () => {
    const longErrorLine1 =
      'llama_model_load: error loading model: error reading header from /models/corrupt-weights.gguf (invalid magic number 0xdeadbeef)';
    const longErrorLine2 =
      'llama_init_from_file: failed to load model with error code -1 and detailed context dimensions mismatch [32, 4096, 128] vs expected [32, 2048, 128]';

    const serverState: ServerState = {
      state: 'error',
      reason: 'Failed to initialize sidecar process on port 18080 due to corrupted model weights header',
      stderr_tail: [longErrorLine1, longErrorLine2],
    };

    const { container } = render(
      <ServerView
        serverState={serverState}
        libraryRecords={mockLibraryRecords}
        onRefreshState={() => {}}
      />
    );

    // Verify error banner is rendered
    expect(
      screen.getByText(/Inference Server Error: Failed to initialize sidecar process/i)
    ).toBeDefined();

    // Verify stderr lines are rendered with whitespace-nowrap
    const stderrElements = container.querySelectorAll('.font-mono.bg-black\\/50 .select-text');
    expect(stderrElements.length).toBe(2);

    stderrElements.forEach((el) => {
      expect(el.className).toContain('whitespace-nowrap');
    });

    // Verify stderr container has max-h and scroll constraints
    const stderrContainer = container.querySelector('.font-mono.bg-black\\/50');
    expect(stderrContainer?.className).toContain('max-h-36');
    expect(stderrContainer?.className).toContain('overflow-auto');

    // Verify logs terminal remains rendered and intact
    expect(screen.getByText('Instance Logs')).toBeDefined();
  });

  it('renders running instance badge when server is serving', async () => {
    const serverState: ServerState = {
      state: 'serving',
      model_id: 'llama-3.1-8b-instruct-q4_k_m',
      model_path: '/models/llama-3.1-8b-instruct-q4_k_m.gguf',
      port: 18080,
      context_size: 4096,
      started_at: '2026-08-31T12:00:00Z',
      instances: [
        {
          model_id: 'llama-3.1-8b-instruct-q4_k_m',
          model_path: '/models/llama-3.1-8b-instruct-q4_k_m.gguf',
          port: 18080,
          context_size: 4096,
          started_at: '2026-08-31T12:00:00Z',
        },
      ],
    };

    render(
      <ServerView
        serverState={serverState}
        libraryRecords={mockLibraryRecords}
        onRefreshState={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Running Model Instances \(1\)/i)).toBeDefined();
      expect(screen.getByText('Stop All Instances (1)')).toBeDefined();
    });
  });
});
