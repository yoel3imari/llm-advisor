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
  MoreHorizontal,
  Copy,
  Trash2,
  Lock,
  Layers,
  Zap,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { FitResult, ModelRecord } from '../../types/domain';
import { VerdictBadge } from '../common/VerdictBadge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';

interface Props {
  results: FitResult[];
  hostBudget: number;
  libraryRecords: ModelRecord[];
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

  const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(0);

  const isDownloaded = (id: string) => libraryRecords.some((r) => r.entry_id === id);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return results.filter((res) => {
      const entry = res.entry;
      const downloaded = isDownloaded(entry.id);

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
  }, [results, searchQuery, familyFilter, verdictFilter, statusFilter, libraryRecords, hostBudget]);

  const columns = useMemo<ColumnDef<FitResult>[]>(
    () => [
      {
        id: 'model',
        accessorFn: (row) => row.entry.id,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
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
          const inLibrary = isDownloaded(entry.id);

          return (
            <div className="flex flex-col py-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-100">{entry.id}</span>
                {entry.gated && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="w-3.5 h-3.5 text-amber-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>HuggingFace Token required</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {inLibrary && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Ready
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                <span className="capitalize px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                  {entry.family}
                </span>
                <span>{entry.params_billions}B params</span>
                {entry.active_params_b && <span>({entry.active_params_b}B active)</span>}
              </div>
            </div>
          );
        },
      },
      {
        id: 'quant_size',
        accessorFn: (row) => row.entry.file_size_bytes,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            Quant / Size
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
            <div className="text-xs">
              <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-200 border border-zinc-700/40">
                {entry.quant}
              </span>
              <div className="text-[11px] text-zinc-400 mt-1 font-mono">{gb(entry.file_size_bytes)} GB</div>
            </div>
          );
        },
      },
      {
        id: 'verdict',
        accessorFn: (row) => (row.fits ? row.score_fit : -1),
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
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
            <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            RAM Needed
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
          const ratio = Math.min((res.est_total_bytes / hostBudget) * 100, 100);
          const overheadBytes = Math.max(
            res.est_total_bytes - res.est_weights_bytes - res.est_kv_bytes,
            0
          );

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-36 space-y-1.5 cursor-help">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-semibold text-zinc-200">{totalGb} GB</span>
                      <span className="text-[10px] text-zinc-400">{Math.round(ratio)}% budget</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        style={{ width: `${ratio}%` }}
                        className={`h-full rounded-full transition-all ${
                          res.fits
                            ? ratio > 85
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="space-y-1 font-mono text-[11px] p-2.5">
                  <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1">
                    Memory Breakdown ({totalGb} GB Total)
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
            </TooltipProvider>
          );
        },
      },
      {
        id: 'max_context',
        accessorFn: (row) => row.max_context_that_fits,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            Max Context
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
          <span className="font-mono text-xs text-zinc-300">
            {row.original.max_context_that_fits.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'gpu_layers',
        accessorFn: (row) => row.recommended_gpu_layers,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            GPU Offload
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
            return <span className="text-[11px] text-zinc-400">0 / {total} (CPU)</span>;
          }
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs text-purple-300 font-semibold">
              <Layers className="w-3 h-3 text-purple-400" />
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
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            Est. Speed
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
          const tps = row.original.speed_tps_estimate;
          return (
            <div className="flex items-center gap-1 font-mono text-xs font-semibold text-cyan-300">
              <Zap className="w-3 h-3 text-cyan-400" />
              {tps.toFixed(1)} tps
            </div>
          );
        },
      },
      {
        id: 'fit_score',
        accessorFn: (row) => row.score_fit,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white"
          >
            Score
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
              className={`font-mono font-bold text-xs ${
                score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {score.toFixed(1)}/10
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-semibold text-zinc-300">Action</span>,
        cell: ({ row }) => {
          const entry = row.original.entry;
          const inLibrary = isDownloaded(entry.id);
          const isCurrentDownloading = downloadingId === entry.id;

          if (inLibrary) {
            return (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onNavigateToServer(entry.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Serve
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Model Options</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onNavigateToServer(entry.id)}>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      Start Serving Process
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigator.clipboard.writeText(entry.repo_id)}
                    >
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      Copy Repo ID
                    </DropdownMenuItem>
                    {onDeleteFromLibrary && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="danger"
                          onClick={() => onDeleteFromLibrary(entry.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          Delete from Library
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          if (isCurrentDownloading) {
            return (
              <button
                disabled
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-medium border border-zinc-700 animate-pulse"
              >
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Downloading...
              </button>
            );
          }

          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onDownload(entry.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Model Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onDownload(entry.id)}>
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    Download GGUF ({gb(entry.file_size_bytes)} GB)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(`https://huggingface.co/${entry.repo_id}`, '_blank')
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    View on HuggingFace
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigator.clipboard.writeText(entry.repo_id)}
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    Copy Repository ID
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [hostBudget, libraryRecords, downloadingId, onDownload, onNavigateToServer, onDeleteFromLibrary]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
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
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-zinc-800 bg-zinc-950/60 text-xs">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 font-semibold text-zinc-300">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
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
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
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
    </div>
  );
}
