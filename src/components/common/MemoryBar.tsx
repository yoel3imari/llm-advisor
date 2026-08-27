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
    <div className="w-full space-y-1.5 text-xs">
      <div className="flex justify-between text-zinc-400">
        <span>Estimated Memory: <strong className={isOverBudget ? 'text-red-400' : 'text-zinc-200'}>{gb(totalBytes)} GB</strong></span>
        <span>Budget: <strong className="text-zinc-200">{gb(budgetBytes)} GB</strong></span>
      </div>
      <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800">
        <div
          style={{ width: `${weightsPct}%` }}
          className="bg-indigo-500 transition-all duration-300"
          title={`Weights: ${gb(weightsBytes)} GB`}
        />
        <div
          style={{ width: `${kvPct}%` }}
          className="bg-cyan-500 transition-all duration-300"
          title={`KV Cache: ${gb(kvBytes)} GB`}
        />
        <div
          style={{ width: `${overheadPct}%` }}
          className="bg-amber-500 transition-all duration-300"
          title={`Overhead & Activations: ${gb(overheadBytes)} GB`}
        />
      </div>
      <div className="flex gap-4 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Weights ({gb(weightsBytes)} GB)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          KV Cache ({gb(kvBytes)} GB)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Overhead ({gb(overheadBytes)} GB)
        </span>
      </div>
    </div>
  );
}
