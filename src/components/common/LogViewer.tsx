import { useEffect, useRef, useState } from 'react';
import { Terminal, ArrowDown, Copy, Check, Trash2 } from 'lucide-react';

interface Props {
  logs: string[];
  onClear?: () => void | Promise<void>;
}

export function LogViewer({ logs, onClear }: Props) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
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

  const handleClearLogs = async () => {
    if (!onClear || logs.length === 0 || clearing) return;
    setClearing(true);
    try {
      await onClear();
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (err) {
      console.error('Failed to clear logs', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs shadow-corporate">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-slate-200">llama-server Logs</span>
          <span className="text-[11px] text-slate-500">({logs.length} lines)</span>
        </div>
        <div className="flex items-center gap-2">
          {onClear && (
            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0 || clearing}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                cleared
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title="Clean up and clear server logs"
            >
              {cleared ? (
                <>
                  <Check className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cleared!</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Clear Logs</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              copied
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
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
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Logs</span>
              </>
            )}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              autoScroll
                ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 p-3.5 overflow-y-auto space-y-0.5 text-slate-300 select-text cursor-text selection:bg-indigo-500/40 selection:text-white custom-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 italic">No logs recorded yet.</div>
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
              ? 'text-rose-400'
              : isLlamaWarn
              ? 'text-amber-400'
              : isLlamaSuccess
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-300';

            return (
              <div
                key={idx}
                className={`leading-relaxed whitespace-pre-wrap break-all select-text cursor-text hover:bg-slate-800/60 px-1 -mx-1 rounded transition-colors ${colorClass}`}
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
