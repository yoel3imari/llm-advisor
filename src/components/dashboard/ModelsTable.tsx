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
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip';

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
  const formatDiskSize = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const downloadedIds = useMemo(
    () => new Set(libraryRecords.map((r) => r.entry_id)),
    [libraryRecords]
  );

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
        accessorFn: (row) => row.max_context_that_fits,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Max Ctx (Tokens)
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
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-cyan-300 whitespace-nowrap">
            {row.original.speed_tps_estimate.toFixed(1)}
          </span>
        ),
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
          const isCurrentDownloading = downloadingId === entry.id;

          if (isCurrentDownloading) {
            return (
              <div className="flex items-center justify-end gap-1.5 font-medium text-[11px] text-indigo-400 whitespace-nowrap">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Downloading...</span>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 shadow-sm transition-colors whitespace-nowrap">
                    
                  </button> */}
                    <MoreVerticalIcon className="cursor-pointer w-3 h-3 text-zinc-400 ml-0.5 shrink-0" />
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
                      <DropdownMenuItem onClick={() => navigator.clipboard.writeText(entry.repo_id)}>
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
                    </>
                  ) : (
                    <>
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
    </div>
  );
}
