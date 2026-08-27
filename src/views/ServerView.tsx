import { useState, useEffect } from 'react';
import { PlayCircle, StopCircle, Copy, Check, AlertTriangle, Globe, Terminal } from 'lucide-react';
import type { ModelRecord, ServerState, ServeConfig } from '../types/domain';
import { startServer, stopServer, getServerLogs } from '../ipc/commands';
import { LogViewer } from '../components/common/LogViewer';

interface Props {
  serverState: ServerState;
  libraryRecords: ModelRecord[];
  initialSelectedModelId?: string | null;
  onRefreshState: () => void;
}

export function ServerView({
  serverState,
  libraryRecords,
  initialSelectedModelId,
  onRefreshState,
}: Props) {
  const [selectedModel, setSelectedModel] = useState<string>(
    initialSelectedModelId || (libraryRecords[0]?.entry_id ?? '')
  );
  const [contextSize, setContextSize] = useState<number>(4096);
  const [kvType, setKvType] = useState<'f16' | 'q8_0'>('f16');
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSelectedModelId) {
      setSelectedModel(initialSelectedModelId);
    } else if (!selectedModel && libraryRecords.length > 0) {
      setSelectedModel(libraryRecords[0].entry_id);
    }
  }, [initialSelectedModelId, libraryRecords, selectedModel]);

  // Poll server logs periodically
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        const lines = await getServerLogs();
        if (active) setLogs(lines);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleToggleServer = async () => {
    setBusy(true);
    try {
      if (serverState.state === 'serving') {
        await stopServer();
      } else {
        const cfg: ServeConfig = {
          context_size: contextSize,
          n_parallel: 1,
          kv_type: kvType,
          n_gpu_layers: null,
        };
        await startServer(selectedModel, cfg);
      }
      onRefreshState();
    } catch (err) {
      console.error('Server toggle failed', err);
    } finally {
      setBusy(false);
    }
  };

  const endpointUrl = 'http://127.0.0.1:13370/v1';
  const curlSnippet = `curl -N http://127.0.0.1:13370/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello!"}],"stream":true}'`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const isServing = serverState.state === 'serving';
  const isStarting = serverState.state === 'starting';

  return (
    <div className="flex-1 p-6 flex flex-col space-y-5 overflow-hidden">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Inference Server Control</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Manage embedded llama-server process and external OpenAI reverse proxy gateway
        </p>
      </div>

      {/* Control Strip */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Target Model</label>
              <select
                disabled={isServing || isStarting || libraryRecords.length === 0}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-medium focus:outline-none focus:border-indigo-500 disabled:opacity-50 min-w-64"
              >
                {libraryRecords.length === 0 ? (
                  <option value="">No downloaded models available</option>
                ) : (
                  libraryRecords.map((r) => (
                    <option key={r.entry_id} value={r.entry_id}>
                      {r.entry_id} ({(r.size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Context Window</label>
              <select
                disabled={isServing || isStarting}
                value={contextSize}
                onChange={(e) => setContextSize(parseInt(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="2048">2,048 tokens</option>
                <option value="4096">4,096 tokens</option>
                <option value="8192">8,192 tokens</option>
                <option value="16384">16,384 tokens</option>
                <option value="32768">32,768 tokens</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">KV Quant</label>
              <div className="flex rounded-lg border border-zinc-700 p-0.5 bg-zinc-950">
                <button
                  disabled={isServing || isStarting}
                  onClick={() => setKvType('f16')}
                  className={`px-3 py-1 text-xs rounded font-mono font-medium ${
                    kvType === 'f16' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  F16
                </button>
                <button
                  disabled={isServing || isStarting}
                  onClick={() => setKvType('q8_0')}
                  className={`px-3 py-1 text-xs rounded font-mono font-medium ${
                    kvType === 'q8_0' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Q8_0
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleServer}
              disabled={busy || isStarting || (!isServing && !selectedModel)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${
                isServing
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 disabled:opacity-50'
              }`}
            >
              {isServing ? (
                <>
                  <StopCircle className="w-5 h-5" />
                  Stop Inference Server
                </>
              ) : isStarting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Starting Sidecar...
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" />
                  Start Serving Model
                </>
              )}
            </button>
          </div>
        </div>

        {/* Endpoint Info Bar */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>OpenAI-Compatible Gateway:</span>
            <code className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-emerald-400 font-mono font-bold">
              {endpointUrl}
            </code>
            <button
              onClick={handleCopyEndpoint}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCopyCurl}
              className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition-colors"
              title="Copy curl snippet"
            >
              <Terminal className="w-3 h-3 text-indigo-400" />
              {copiedCurl ? 'Copied curl!' : 'Copy curl'}
            </button>
          </div>

          <div className="text-zinc-400 italic text-[11px]">
            {isServing ? 'Ready for requests from Cursor, Continue, or curl' : 'Gateway returns 503 while idle'}
          </div>
        </div>
      </div>

      {/* Error state alert */}
      {serverState.state === 'error' && (
        <div className="p-4 bg-red-950/80 border border-red-800 rounded-xl space-y-2 text-xs text-red-200">
          <div className="flex items-center gap-2 font-bold text-red-300">
            <AlertTriangle className="w-4 h-4" />
            <span>Inference Server Error: {serverState.reason}</span>
          </div>
          {serverState.stderr_tail.length > 0 && (
            <div className="font-mono bg-black/50 p-2.5 rounded border border-red-900/60 overflow-x-auto space-y-0.5">
              {serverState.stderr_tail.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Logs Terminal */}
      <div className="flex-1 min-h-0">
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
