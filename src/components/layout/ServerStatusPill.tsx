import type { ServerState } from '../../types/domain';

interface Props {
  state: ServerState;
}

export function ServerStatusPill({ state }: Props) {
  if (state.state === 'serving') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-phosphor-950/70 border border-phosphor-500/40 text-phosphor-300 text-[11px] font-semibold tracking-wide shadow-jewel-green">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-phosphor-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-phosphor-400"></span>
        </span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Running</span>
      </div>
    );
  }

  if (state.state === 'starting') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-voltage-950/70 border border-voltage-500/40 text-voltage-300 text-[11px] font-semibold tracking-wide shadow-jewel-amber">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-voltage-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-voltage-400"></span>
        </span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Starting</span>
      </div>
    );
  }

  if (state.state === 'error') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-laser-950/70 border border-laser-500/40 text-laser-300 text-[11px] font-semibold tracking-wide">
        <span className="w-2 h-2 rounded-full bg-laser-500"></span>
        <span className="uppercase text-[10px] tracking-wider font-mono">Error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-obsidian-950/80 border border-white/[0.08] text-zinc-400 text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
      <span className="uppercase text-[10px] tracking-wider font-mono text-zinc-400">Idle</span>
    </div>
  );
}
