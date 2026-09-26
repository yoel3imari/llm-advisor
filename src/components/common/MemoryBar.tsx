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
      <div className="flex justify-between items-center text-zinc-400 font-mono text-[11px] tabular-nums">
        <span>
          Est. Footprint:{' '}
          <strong className={isOverBudget ? 'text-laser-400 font-semibold' : 'text-zinc-100 font-semibold'}>
            {gb(totalBytes)} GB
          </strong>
        </span>
        <span>
          Host Budget: <strong className="text-telemetry-300 font-semibold">{gb(budgetBytes)} GB</strong>
        </span>
      </div>

      {/* Segmented Track Bar */}
      <div className="h-2.5 w-full bg-obsidian-950 rounded-full overflow-hidden flex border border-white/[0.08] shadow-well p-[1px]">
        <div
          style={{ width: `${weightsPct}%` }}
          className="bg-gradient-to-r from-violet-700 to-violet-500 rounded-l-full transition-all duration-300 relative group"
          title={`Weights: ${gb(weightsBytes)} GB`}
        />
        <div
          style={{ width: `${kvPct}%` }}
          className="bg-telemetry-400 transition-all duration-300"
          title={`KV Cache: ${gb(kvBytes)} GB`}
        />
        <div
          style={{ width: `${overheadPct}%` }}
          className="bg-voltage-400 transition-all duration-300 rounded-r-full"
          title={`Overhead & CUDA/Metal: ${gb(overheadBytes)} GB`}
        />
      </div>

      {/* Breakdown Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono tabular-nums text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Weights ({gb(weightsBytes)} GB)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-telemetry-400" />
          KV Cache ({gb(kvBytes)} GB)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-voltage-400" />
          Overhead ({gb(overheadBytes)} GB)
        </span>
      </div>
    </div>
  );
}
