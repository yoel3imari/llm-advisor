import type { ServerState } from '../../types/domain';

interface Props {
  state: ServerState;
}

export function ServerStatusPill({ state }: Props) {
  if (state.state === 'serving') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Running</span>
      </div>
    );
  }

  if (state.state === 'starting') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-300 text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span>Starting...</span>
      </div>
    );
  }

  if (state.state === 'error') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span>Server Error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
      <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
      <span>Stopped</span>
    </div>
  );
}
