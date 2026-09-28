import type { ServerState } from '../../types/domain';
import { cn } from '../../lib/utils';

interface Props {
  state: ServerState;
  compact?: boolean;
}

export function ServerStatusPill({ state, compact = false }: Props) {
  if (state.state === 'serving') {
    return (
      <div
        className={cn(
          'flex items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          compact
            ? 'p-2 justify-center border border-transparent'
            : 'gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80 text-[11px] font-semibold tracking-wide shadow-sm'
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap uppercase text-[10px] tracking-wider font-mono transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            compact ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[70px] opacity-100 translate-x-0'
          )}
        >
          Running
        </span>
      </div>
    );
  }

  if (state.state === 'starting') {
    return (
      <div
        className={cn(
          'flex items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          compact
            ? 'p-2 justify-center border border-transparent'
            : 'gap-2 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80 text-[11px] font-semibold tracking-wide shadow-sm'
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap uppercase text-[10px] tracking-wider font-mono transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            compact ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[70px] opacity-100 translate-x-0'
          )}
        >
          Starting
        </span>
      </div>
    );
  }

  if (state.state === 'error') {
    return (
      <div
        className={cn(
          'flex items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          compact
            ? 'p-2 justify-center border border-transparent'
            : 'gap-2 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80 text-[11px] font-semibold tracking-wide shadow-sm'
        )}
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap uppercase text-[10px] tracking-wider font-mono transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            compact ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[70px] opacity-100 translate-x-0'
          )}
        >
          Error
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        compact
          ? 'p-2 justify-center border border-transparent'
          : 'gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[11px] font-medium'
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap uppercase text-[10px] tracking-wider font-mono transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          compact ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[70px] opacity-100 translate-x-0'
        )}
      >
        Idle
      </span>
    </div>
  );
}
