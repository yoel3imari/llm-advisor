import type { ServerState } from '../../types/domain';

interface Props {
  state: ServerState;
}

export function ServerStatusPill({ state }: Props) {
  if (state.state === 'serving') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80 text-[11px] font-semibold tracking-wide shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Running</span>
      </div>
    );
  }

  if (state.state === 'starting') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80 text-[11px] font-semibold tracking-wide shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Starting</span>
      </div>
    );
  }

  if (state.state === 'error') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80 text-[11px] font-semibold tracking-wide shadow-sm">
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
      <span className="uppercase text-[10px] tracking-wider font-mono">Idle</span>
    </div>
  );
}
