import { useEffect, useRef, useState } from 'react';
import { Terminal, ArrowDown } from 'lucide-react';

interface Props {
  logs: string[];
}

export function LogViewer({ logs }: Props) {
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-zinc-200">llama-server Logs</span>
          <span className="text-[11px] text-zinc-400">({logs.length} lines)</span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
            autoScroll
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}
        >
          <ArrowDown className="w-3 h-3" />
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-1 text-zinc-300">
        {logs.length === 0 ? (
          <div className="text-zinc-400 italic">No logs recorded yet.</div>
        ) : (
          logs.map((line, idx) => {
            const isErr = line.includes('[ERR]') || line.includes('error') || line.includes('Error');
            const isWarn = line.includes('[WARN]') || line.includes('warning');
            return (
              <div
                key={idx}
                className={`leading-relaxed whitespace-pre-wrap break-all ${
                  isErr ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-zinc-300'
                }`}
              >
                {line}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
