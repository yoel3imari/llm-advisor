import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModelsTable } from './ModelsTable';
import { TooltipProvider } from '../ui/Tooltip';
import type { FitResult, ModelRecord } from '../../types/domain';

const mockFitResults: FitResult[] = [
  {
    entry: {
      id: 'llama-3.1-8b-instruct',
      family: 'llama',
      params_billions: 8.0,
      active_params_b: null,
      quant: 'Q4_K_M',
      filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
      repo_id: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
      file_size_bytes: 4920700000,
      n_layers: 32,
      n_kv_heads: 8,
      head_dim: 128,
      context_train: 131072,
      sha256: 'mock-sha256',
      gated: false,
      quality_tier: 1,
      tags: ['coding', 'general'],
      benchmarks: {
        swe_bench: 38.8,
        livecodebench: 33.4,
        mmlu_pro: 44.1,
        arena_elo: 1210,
        human_eval: 72.6,
      },
    },
    fits: true,
    score_fit: 8.5,
    score_speed: 9.0,
    score_quality: 8.0,
    est_total_bytes: 5800000000,
    est_weights_bytes: 4920700000,
    est_kv_bytes: 650000000,
    speed_tps_estimate: 42.5,
    recommended_gpu_layers: 32,
    max_context_that_fits: 32768,
    usable_context: 32768,
    is_context_constrained: false,
  },
];

const mockLibraryRecords: ModelRecord[] = [
  {
    entry_id: 'llama-3.1-8b-instruct',
    file_path: '/models/llama-3.1-8b-instruct.gguf',
    size_bytes: 4920700000,
    verified: true,
    added_at: '2026-09-28T00:00:00Z',
  },
];

describe('ModelsTable Light Mode Text & Badge Colors', () => {
  it('renders table headers with accessible light-mode slate colors instead of hardcoded zinc', () => {
    render(
      <TooltipProvider>
        <ModelsTable
          results={mockFitResults}
          hostBudget={16 * 1024 * 1024 * 1024}
          libraryRecords={mockLibraryRecords}
          downloadingId={null}
          onDownload={vi.fn()}
          onNavigateToServer={vi.fn()}
          searchQuery=""
          familyFilter="all"
          verdictFilter="all"
          statusFilter="all"
        />
      </TooltipProvider>
    );

    const modelHeaderBtn = screen.getByRole('button', { name: /Model & Family/i });
    expect(modelHeaderBtn.className).toContain('text-slate-700');
    expect(modelHeaderBtn.className).toContain('dark:text-slate-300');
    expect(modelHeaderBtn.className).not.toContain('text-zinc-300');

    const paramsHeaderBtn = screen.getByRole('button', { name: /Params \(B\)/i });
    expect(paramsHeaderBtn.className).toContain('text-slate-700');
    expect(paramsHeaderBtn.className).not.toContain('text-zinc-300');

    const quantHeaderBtn = screen.getByRole('button', { name: /Quant/i });
    expect(quantHeaderBtn.className).toContain('text-slate-700');
    expect(quantHeaderBtn.className).not.toContain('text-zinc-300');
  });

  it('renders cell texts and badges with high-contrast light-mode classes', () => {
    render(
      <TooltipProvider>
        <ModelsTable
          results={mockFitResults}
          hostBudget={16 * 1024 * 1024 * 1024}
          libraryRecords={mockLibraryRecords}
          downloadingId={null}
          onDownload={vi.fn()}
          onNavigateToServer={vi.fn()}
          searchQuery=""
          familyFilter="all"
          verdictFilter="all"
          statusFilter="all"
        />
      </TooltipProvider>
    );

    // Model name should be dark slate in light mode (not text-zinc-100)
    const modelName = screen.getByText('llama-3.1-8b-instruct');
    expect(modelName.className).toContain('text-slate-900');
    expect(modelName.className).toContain('dark:text-slate-100');
    expect(modelName.className).not.toContain('text-zinc-100');

    // Ready badge should have light background and dark emerald text in light mode
    const readyBadge = screen.getByText('Ready');
    expect(readyBadge.className).toContain('bg-emerald-50');
    expect(readyBadge.className).toContain('text-emerald-700');

    // Family badge should have light slate background in light mode
    const familyBadge = screen.getByText('llama');
    expect(familyBadge.className).toContain('bg-slate-100');
    expect(familyBadge.className).toContain('text-slate-700');

    // Quant badge should have light slate background in light mode
    const quantBadge = screen.getByText('Q4_K_M');
    expect(quantBadge.className).toContain('bg-slate-100');
    expect(quantBadge.className).toContain('text-slate-700');

    // Benchmark chips should use light background with high contrast text
    const sweChip = screen.getByText(/SWE 38.8%/);
    expect(sweChip.className).toContain('bg-emerald-50');
    expect(sweChip.className).toContain('text-emerald-700');

    const lcbChip = screen.getByText(/LCB 33.4/);
    expect(lcbChip.className).toContain('bg-cyan-50');
    expect(lcbChip.className).toContain('text-cyan-700');

    // Speed TPS should be high contrast cyan in light mode
    const speed = screen.getByText('42.5');
    expect(speed.className).toContain('text-cyan-700');
    expect(speed.className).toContain('dark:text-cyan-300');

    // GPU Layers should be high contrast purple in light mode
    const layers = screen.getByText('32 / 32');
    expect(layers.className).toContain('text-purple-700');
    expect(layers.className).toContain('dark:text-purple-300');

    // Fit score should be high contrast emerald in light mode
    const score = screen.getByText('8.5');
    expect(score.className).toContain('text-emerald-600');
    expect(score.className).toContain('dark:text-emerald-400');
  });
});
