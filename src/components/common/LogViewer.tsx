import { useEffect, useRef, useState } from 'react';
import { Terminal, ArrowDown, Copy, Check } from 'lucide-react';

interface Props {
  logs: string[];
}

export function LogViewer({ logs }: Props) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs to clipboard', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-zinc-200">llama-server Logs</span>
          <span className="text-[11px] text-zinc-400">({logs.length} lines)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
              copied
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title="Copy all logs to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Logs</span>
              </>
            )}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
              autoScroll
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-1 text-zinc-300">
        {logs.length === 0 ? (
          <div className="text-zinc-400 italic">No logs recorded yet.</div>
        ) : (
          logs.map((line, idx) => {
            const clean = line.replace(/^\[ERR\]\s*/, '');
            const isLlamaErr =
              /\s+E\s+[a-z0-9_]+:|\berror\b|\bfatal\b|\bpanic\b/i.test(clean);
            const isLlamaWarn =
              /\s+W\s+[a-z0-9_]+:|\bwarning\b|\bWARN\b/i.test(clean);
            const isLlamaSuccess =
              /model loaded|listening on|HTTP server is listening/i.test(clean);

            const colorClass = isLlamaErr
              ? 'text-red-400'
              : isLlamaWarn
              ? 'text-amber-400'
              : isLlamaSuccess
              ? 'text-emerald-400 font-medium'
              : 'text-zinc-300';

            return (
              <div
                key={idx}
                className={`leading-relaxed whitespace-pre-wrap break-all ${colorClass}`}
              >
                {clean}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
