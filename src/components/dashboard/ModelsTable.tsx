import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Play,
  Copy,
  Trash2,
  Lock,
  Layers,
  Zap,
  CheckCircle2,
  ExternalLink,
  MoreVerticalIcon,
  LoaderIcon,
  Award,
} from 'lucide-react';
import { VerdictBadge } from '../common/VerdictBadge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip';
import { openExternalUrl } from '../../utils/browser';
import { DeleteConfirmDialog } from '../ui/DeleteConfirmDialog';
import type { FitResult, ModelRecord, DownloadTask } from '../../types/domain';

interface Props {
  results: FitResult[];
  hostBudget: number;
  libraryRecords: ModelRecord[];
  activeDownloads?: DownloadTask[];
  downloadingId: string | null;
  onDownload: (entryId: string) => Promise<void>;
  onNavigateToServer: (modelId: string) => void;
  onDeleteFromLibrary?: (entryId: string) => void;
  searchQuery: string;
  familyFilter: string;
  verdictFilter: string;
  statusFilter: string;
}

export function ModelsTable({
  results,
  hostBudget,
  libraryRecords,
  activeDownloads = [],
  downloadingId,
  onDownload,
  onNavigateToServer,
  onDeleteFromLibrary,
  searchQuery,
  familyFilter,
  verdictFilter,
  statusFilter,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'fit_score', desc: true },
  ]);
  const [deleteModelTarget, setDeleteModelTarget] = useState<{
    id: string;
    sizeBytes: number;
  } | null>(null);

  const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(0);
  const formatDiskSize = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const libraryKey = useMemo(
    () => libraryRecords.map((r) => r.entry_id).sort().join(','),
    [libraryRecords]
  );

  const downloadedIds = useMemo(
    () => new Set(libraryRecords.map((r) => r.entry_id)),
    [libraryKey]
  );

  const downloadsStatusKey = useMemo(
    () =>
      activeDownloads
        .map((d) => `${d.entry_id}:${d.state.status}:${d.error ? 'err' : 'ok'}`)
        .sort()
        .join(','),
    [activeDownloads]
  );

  const downloadingEntryIds = useMemo(() => {
    const ids = new Set<string>();
    if (downloadingId) ids.add(downloadingId);
    for (const d of activeDownloads) {
      if (d.state.status !== 'failed' && !d.error) {
        ids.add(d.entry_id);
      }
    }
    return ids;
  }, [downloadingId, downloadsStatusKey]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return results.filter((res) => {
      const entry = res.entry;
      const downloaded = downloadedIds.has(entry.id);

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = entry.id.toLowerCase().includes(q) || entry.filename.toLowerCase().includes(q);
        const matchesFamily = entry.family.toLowerCase().includes(q);
        const matchesQuant = entry.quant.toLowerCase().includes(q);
        if (!matchesName && !matchesFamily && !matchesQuant) return false;
      }

      // Family match
      if (familyFilter !== 'all' && entry.family.toLowerCase() !== familyFilter.toLowerCase()) {
        return false;
      }

      // Verdict match
      if (verdictFilter !== 'all') {
        const v = res.fits ? (res.est_total_bytes > hostBudget * 0.9 ? 'tight' : 'fits') : 'nofit';
        if (verdictFilter === 'fits' && v !== 'fits') return false;
        if (verdictFilter === 'tight' && v !== 'tight') return false;
        if (verdictFilter === 'nofit' && v !== 'nofit') return false;
      }

      // Status match
      if (statusFilter === 'downloaded' && !downloaded) return false;
      if (statusFilter === 'available' && downloaded) return false;

      return true;
    });
  }, [results, searchQuery, familyFilter, verdictFilter, statusFilter, downloadedIds, hostBudget]);

  const columns = useMemo<ColumnDef<FitResult>[]>(
    () => [
      {
        id: 'model',
        accessorFn: (row) => row.entry.id,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Model & Family
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const entry = row.original.entry;
          const inLibrary = downloadedIds.has(entry.id);

          return (
            <div className="flex flex-col py-0.5 min-w-[170px]">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-semibold text-zinc-100">{entry.id}</span>
                {entry.gated && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="w-3.5 h-3.5 text-amber-400 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>HuggingFace Token required</TooltipContent>
                  </Tooltip>
                )}
                {inLibrary && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Ready
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-400">
                <span className="capitalize px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                  {entry.family}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'params',
        accessorFn: (row) => row.entry.params_billions,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Params (B)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const entry = row.original.entry;
          return (
            <span className="font-mono text-xs text-zinc-300 whitespace-nowrap">
              {entry.params_billions}B
              {entry.active_params_b && (
                <span className="text-zinc-500 text-[10px] ml-1">({entry.active_params_b}B act)</span>
              )}
            </span>
          );
        },
      },
      {
        id: 'quant',
        accessorFn: (row) => row.entry.quant,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Quant
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-200 border border-zinc-700/40 whitespace-nowrap">
            {row.original.entry.quant}
          </span>
        ),
      },
      {
        id: 'benchmarks',
        accessorFn: (row) => {
          const b = row.entry.benchmarks;
          if (!b) return 0;
          return (
            (b.swe_bench ?? 0) * 100 +
            (b.livecodebench ?? 0) * 50 +
            (b.mmlu_pro ?? 0) * 10 +
            (b.arena_elo ?? 0)
          );
        },
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Benchmarks
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const b = row.original.entry.benchmarks;
          if (
            !b ||
            (!b.swe_bench && !b.livecodebench && !b.mmlu_pro && !b.arena_elo && !b.human_eval)
          ) {
            return <span className="text-zinc-600 text-xs font-mono">—</span>;
          }

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-wrap items-center gap-1 cursor-help max-w-[210px]">
                  {b.swe_bench !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 whitespace-nowrap">
                      SWE {b.swe_bench}%
                    </span>
                  )}
                  {b.livecodebench !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 whitespace-nowrap">
                      LCB {b.livecodebench}
                    </span>
                  )}
                  {b.mmlu_pro !== undefined && !b.swe_bench && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-violet-950/80 text-violet-300 border border-violet-800/60 whitespace-nowrap">
                      MMLU {b.mmlu_pro}%
                    </span>
                  )}
                  {b.arena_elo !== undefined && !b.swe_bench && !b.livecodebench && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60 whitespace-nowrap">
                      Elo {b.arena_elo}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="space-y-1.5 font-mono text-[11px] p-3 max-w-xs shadow-xl">
                <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1 flex items-center justify-between">
                  <span>Verified Benchmarks</span>
                  {b.arena_elo && <span className="text-amber-400">Elo {b.arena_elo}</span>}
                </div>
                {b.swe_bench !== undefined && (
                  <div className="flex justify-between gap-4 text-zinc-300">
                    <span className="text-emerald-400">SWE-bench Verified:</span>
                    <span className="font-bold text-zinc-100">{b.swe_bench}% resolved</span>
                  </div>
                )}
                {b.livecodebench !== undefined && (
                  <div className="flex justify-between gap-4 text-zinc-300">
                    <span className="text-cyan-400">LiveCodeBench:</span>
                    <span className="font-bold text-zinc-100">{b.livecodebench} pass@1</span>
                  </div>
                )}
                {b.mmlu_pro !== undefined && (
                  <div className="flex justify-between gap-4 text-zinc-300">
                    <span className="text-violet-400">MMLU-Pro:</span>
                    <span className="font-bold text-zinc-100">{b.mmlu_pro}%</span>
                  </div>
                )}
                {b.human_eval !== undefined && (
                  <div className="flex justify-between gap-4 text-zinc-300">
                    <span className="text-indigo-400">HumanEval:</span>
                    <span className="font-bold text-zinc-100">{b.human_eval}% pass@1</span>
                  </div>
                )}
                <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                  Real-world benchmarks (SWE-bench, LiveCodeBench, LMSYS Arena).
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'file_size',
        accessorFn: (row) => row.entry.file_size_bytes,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Disk
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-zinc-300 whitespace-nowrap">
            {formatDiskSize(row.original.entry.file_size_bytes)}
          </span>
        ),
      },
      {
        id: 'verdict',
        accessorFn: (row) => (row.fits ? row.score_fit : -1),
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Verdict
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const res = row.original;
          return (
            <div className="flex items-center">
              <VerdictBadge
                fits={res.fits}
                scoreFit={res.score_fit}
              />
            </div>
          );
        },
      },
      {
        id: 'memory_fit',
        accessorFn: (row) => row.est_total_bytes,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            RAM Needed (GB)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const res = row.original;
          const totalGb = gb(res.est_total_bytes);
          const overheadBytes = Math.max(
            res.est_total_bytes - res.est_weights_bytes - res.est_kv_bytes,
            0
          );

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs font-semibold text-zinc-100 cursor-help underline decoration-dotted decoration-zinc-600 underline-offset-2">
                  {totalGb}
                </span>
              </TooltipTrigger>
              <TooltipContent className="space-y-1 font-mono text-[11px] p-2.5">
                <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1">
                  RAM Breakdown ({totalGb} GB Total)
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Model Weights:</span> <span>{gb(res.est_weights_bytes)} GB</span>
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>KV Cache ({mb(res.est_kv_bytes)} MB):</span>{' '}
                  <span>{gb(res.est_kv_bytes)} GB</span>
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Overhead + Activations:</span> <span>{mb(overheadBytes)} MB</span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'max_context',
        accessorFn: (row) => row.usable_context ?? row.max_context_that_fits,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Usable Ctx
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const res = row.original;
          const usable = res.usable_context ?? res.max_context_that_fits;
          const native = res.entry.context_train;
          const isConstrained = res.is_context_constrained || usable < native;
          const usableK = usable >= 1024 ? `${Math.round(usable / 1024)}k` : `${usable}`;
          const nativeK = native >= 1024 ? `${Math.round(native / 1024)}k` : `${native}`;

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  {isConstrained ? (
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${
                      usable < 4096
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800/50 font-semibold'
                        : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/50'
                    }`}>
                      {usableK} <span className="text-zinc-500 font-normal">→ {nativeK}</span>
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-zinc-300 whitespace-nowrap">
                      {nativeK}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="space-y-1 font-mono text-[11px] p-2.5 max-w-xs">
                <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1">
                  Context Window Headroom
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Usable Context:</span>{' '}
                  <span className="font-semibold text-emerald-300">{usable.toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Native Context:</span> <span>{native.toLocaleString()} tokens</span>
                </div>
                <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                  {isConstrained
                    ? 'Context is dynamically bounded by RAM headroom to prevent paging.'
                    : 'Full native model context fits within system working memory.'}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'gpu_layers',
        accessorFn: (row) => row.recommended_gpu_layers,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            GPU Layers
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const res = row.original;
          const layers = res.recommended_gpu_layers;
          const total = res.entry.n_layers;

          if (layers === 0) {
            return <span className="text-[11px] text-zinc-400 font-mono whitespace-nowrap">0 / {total} (CPU)</span>;
          }
          return (
            <span className="font-mono text-xs text-purple-300 font-semibold whitespace-nowrap">
              {layers} / {total}
            </span>
          );
        },
      },
      {
        id: 'speed_tps',
        accessorFn: (row) => row.speed_tps_estimate,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            Speed (TPS)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const res = row.original;
          const layers = res.recommended_gpu_layers;
          const total = res.entry.n_layers;
          const runMode = layers === total && total > 0
            ? '100% GPU VRAM'
            : layers > 0
            ? `Partial Offload (${layers}/${total} layers)`
            : 'CPU DDR RAM';

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs font-semibold text-cyan-300 cursor-help underline decoration-dotted decoration-cyan-700/60 underline-offset-2 whitespace-nowrap">
                  {res.speed_tps_estimate.toFixed(1)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="space-y-1 font-mono text-[11px] p-2.5 max-w-xs">
                <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1">
                  Throughput (Roofline Model)
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Estimated Speed:</span>{' '}
                  <span className="font-semibold text-cyan-300">~{res.speed_tps_estimate.toFixed(1)} tok/s</span>
                </div>
                <div className="flex justify-between gap-4 text-zinc-300">
                  <span>Execution Mode:</span> <span>{runMode}</span>
                </div>
                <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                  Calculated from hardware memory bandwidth roofline and active parameter footprint.
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'fit_score',
        accessorFn: (row) => row.score_fit,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Score (/10)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const score = row.original.score_fit;
          return (
            <span
              className={`font-mono font-bold text-xs whitespace-nowrap ${
                score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {score.toFixed(1)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-semibold text-zinc-300">
          <MoreVerticalIcon className="w-3 h-3 text-zinc-400 ml-0.5 shrink-0" />
        </span>,
        cell: ({ row }) => {
          const entry = row.original.entry;
          const inLibrary = downloadedIds.has(entry.id);
          const isCurrentDownloading = downloadingEntryIds.has(entry.id);

          if (isCurrentDownloading) {
            return (
              <div className="flex items-center justify-end pr-1">
                <LoaderIcon className="animate-spin text-indigo-400" size={16} />
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MoreVerticalIcon className="cursor-pointer w-3 h-3 text-zinc-400 ml-0.5 shrink-0 hover:text-zinc-200 transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Model Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {inLibrary ? (
                    <>
                      <DropdownMenuItem onClick={() => onNavigateToServer(entry.id)}>
                        <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        Start Serving Model
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openExternalUrl(`https://huggingface.co/${entry.repo_id}`)
                        }
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                        View on HuggingFace
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigator.clipboard.writeText(entry.repo_id)}>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        Copy Repo ID
                      </DropdownMenuItem>
                      {onDeleteFromLibrary && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="danger"
                            onClick={() =>
                              setDeleteModelTarget({
                                id: entry.id,
                                sizeBytes: entry.file_size_bytes,
                              })
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            Delete from Library
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => onDownload(entry.id)}>
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        Download GGUF ({gb(entry.file_size_bytes)} GB)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openExternalUrl(`https://huggingface.co/${entry.repo_id}`)
                        }
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                        View on HuggingFace
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigator.clipboard.writeText(entry.repo_id)}>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        Copy Repo ID
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      hostBudget,
      downloadedIds,
      downloadingEntryIds,
      onDownload,
      onNavigateToServer,
      onDeleteFromLibrary,
    ]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.entry.id,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-zinc-800 bg-zinc-950/80 text-xs">
                  {headerGroup.headers.map((header) => {
                    const isActions = header.id === 'actions';
                    return (
                      <th
                        key={header.id}
                        className={`px-3.5 py-3 font-semibold text-zinc-300 ${
                          isActions
                            ? 'sticky right-0 z-20 bg-zinc-950 shadow-[-6px_0_12px_rgba(0,0,0,0.4)] border-l border-zinc-800 text-right'
                            : ''
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-400">
                    No models matching the selected filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-800/40 transition-colors group"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isActions = cell.column.id === 'actions';
                      return (
                        <td
                          key={cell.id}
                          className={`px-3.5 py-2.5 ${
                            isActions
                              ? 'sticky right-0 z-10 bg-zinc-900 group-hover:bg-zinc-850 shadow-[-6px_0_12px_rgba(0,0,0,0.4)] border-l border-zinc-800/60 text-right'
                              : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950/40 text-xs text-zinc-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-zinc-200">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-zinc-200">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  filteredData.length
                )}
              </span>{' '}
              of <span className="font-semibold text-zinc-200">{filteredData.length}</span> models
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
              >
                Previous
              </button>
              <span className="font-mono text-zinc-300">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteModelTarget && (
        <DeleteConfirmDialog
          open={!!deleteModelTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteModelTarget(null);
          }}
          modelId={deleteModelTarget.id}
          sizeBytes={deleteModelTarget.sizeBytes}
          onConfirm={async () => {
            if (onDeleteFromLibrary) {
              await onDeleteFromLibrary(deleteModelTarget.id);
            }
          }}
        />
      )}
    </div>
  );
}
