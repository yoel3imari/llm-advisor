interface Props {
  weightsBytes: number;
  kvBytes: number;
  totalBytes: number;
  budgetBytes: number;
}

export function MemoryBar({ weightsBytes, kvBytes, totalBytes, budgetBytes }: Props) {
  const gb = (b: number) => (b / (1024 * 1024 * 1024)).toFixed(2);
  const safeBudget = Math.max(budgetBytes, totalBytes);
  
  const weightsPct = Math.min(100, (weightsBytes / safeBudget) * 100);
  const kvPct = Math.min(100 - weightsPct, (kvBytes / safeBudget) * 100);
  const overheadBytes = Math.max(0, totalBytes - (weightsBytes + kvBytes));
  const overheadPct = Math.min(100 - (weightsPct + kvPct), (overheadBytes / safeBudget) * 100);

  const isOverBudget = totalBytes > budgetBytes;

  return (
    <div className="w-full space-y-2 text-xs select-none">
      <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-mono text-[11px] tabular-nums">
        <span>
          Est. Footprint:{' '}
          <strong className={isOverBudget ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-800 dark:text-slate-200 font-bold'}>
            {gb(totalBytes)} GB
          </strong>
        </span>
        <span>
          Host Budget: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{gb(budgetBytes)} GB</strong>
        </span>
      </div>

      {/* Segmented Track Bar */}
      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200/80 dark:border-slate-700/80 shadow-inner p-[1px]">
        <div
          style={{ width: `${weightsPct}%` }}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-l-full transition-all duration-300 relative group"
          title={`Weights: ${gb(weightsBytes)} GB`}
        />
        <div
          style={{ width: `${kvPct}%` }}
          className="bg-indigo-400 dark:bg-indigo-500 transition-all duration-300"
          title={`KV Cache: ${gb(kvBytes)} GB`}
        />
        <div
          style={{ width: `${overheadPct}%` }}
          className="bg-amber-400 dark:bg-amber-500 transition-all duration-300 rounded-r-full"
          title={`Overhead & CUDA/Metal: ${gb(overheadBytes)} GB`}
        />
      </div>

      {/* Breakdown Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
          Weights ({gb(weightsBytes)} GB)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
          KV Cache ({gb(kvBytes)} GB)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          Overhead ({gb(overheadBytes)} GB)
        </span>
      </div>
    </div>
  );
}
