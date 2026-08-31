import { useState, useEffect } from 'react';
import {
  StopCircle,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Terminal,
  ChevronDown,
  Cpu,
  Plus,
  X,
  Layers,
} from 'lucide-react';
import type { ModelRecord, ServerState, ServeConfig, KvType, RunningInstanceInfo } from '../types/domain';
import { startServer, stopServer, stopInstance, getServerLogs } from '../ipc/commands';
import { LogViewer } from '../components/common/LogViewer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/DropdownMenu';

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
  const [kvType, setKvType] = useState<KvType>('f16');
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedLogModel, setSelectedLogModel] = useState<string>('all');
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
        const modelParam = selectedLogModel === 'all' ? undefined : selectedLogModel;
        const lines = await getServerLogs(modelParam);
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
  }, [selectedLogModel]);

  const activeInstances: RunningInstanceInfo[] =
    serverState.state === 'serving'
      ? serverState.instances && serverState.instances.length > 0
        ? serverState.instances
        : [
            {
              model_id: serverState.model_id,
              model_path: serverState.model_path,
              port: serverState.port,
              context_size: serverState.context_size,
              started_at: serverState.started_at,
            },
          ]
      : [];

  const isModelRunning = (modelId: string) =>
    activeInstances.some((inst) => inst.model_id === modelId);

  const handleLaunchModel = async () => {
    if (!selectedModel) return;
    setBusy(true);
    try {
      const cfg: ServeConfig = {
        context_size: contextSize,
        n_parallel: 1,
        kv_type: kvType,
        n_gpu_layers: null,
      };
      await startServer(selectedModel, cfg);
      onRefreshState();
    } catch (err) {
      console.error('Failed to launch model', err);
    } finally {
      setBusy(false);
    }
  };

  const handleStopInstance = async (modelId: string) => {
    setBusy(true);
    try {
      await stopInstance(modelId);
      onRefreshState();
    } catch (err) {
      console.error(`Failed to stop instance ${modelId}`, err);
    } finally {
      setBusy(false);
    }
  };

  const handleStopAll = async () => {
    setBusy(true);
    try {
      await stopServer();
      onRefreshState();
    } catch (err) {
      console.error('Failed to stop all instances', err);
    } finally {
      setBusy(false);
    }
  };

  const endpointUrl = 'http://127.0.0.1:13370/v1';
  const curlSnippet = `curl -N http://127.0.0.1:13370/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${selectedModel || 'default'}","messages":[{"role":"user","content":"Hello!"}],"stream":true}'`;

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

  const isStarting = serverState.state === 'starting';

  return (
    <div className="flex-1 p-6 flex flex-col space-y-5 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Inference Server Control</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Multi-model sidecar pool with automatic request routing on localhost:13370
          </p>
        </div>

        {activeInstances.length > 0 && (
          <button
            onClick={handleStopAll}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold transition-colors self-start sm:self-auto"
            title="Stop all running sidecars"
          >
            <StopCircle className="w-4 h-4 text-red-400" />
            <span>Stop All Instances ({activeInstances.length})</span>
          </button>
        )}
      </div>

      {/* Active Running Instances Pool Strip */}
      {activeInstances.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Running Model Instances ({activeInstances.length})</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-normal">
              External apps route automatically via <code className="text-indigo-300 font-mono">"model": "&lt;id&gt;"</code>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeInstances.map((inst) => (
              <div
                key={inst.model_id}
                className="bg-zinc-900/90 border border-indigo-900/50 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-lg shadow-indigo-950/20"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-semibold text-white text-xs truncate" title={inst.model_id}>
                      {inst.model_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400">
                      :{inst.port}
                    </span>
                    <span>{inst.context_size.toLocaleString()} ctx</span>
                  </div>
                </div>

                <button
                  onClick={() => handleStopInstance(inst.model_id)}
                  disabled={busy}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/80 hover:text-red-300 border border-zinc-700 hover:border-red-800 text-zinc-400 transition-colors shrink-0"
                  title={`Stop instance ${inst.model_id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Launcher Strip */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Model to Launch</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isStarting || libraryRecords.length === 0}
                    className="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-medium focus:outline-none focus:border-indigo-500 disabled:opacity-50 min-w-64 hover:border-zinc-600 transition-colors"
                  >
                    <span className="truncate">
                      {libraryRecords.length === 0
                        ? 'No downloaded models available'
                        : selectedModel || 'Select a model...'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-400 opacity-80 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64 max-h-60 overflow-y-auto">
                  <DropdownMenuLabel>Downloaded Models</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                    {libraryRecords.map((r) => {
                      const isRunning = isModelRunning(r.entry_id);
                      return (
                        <DropdownMenuRadioItem key={r.entry_id} value={r.entry_id}>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-200">{r.entry_id}</span>
                              {isRunning && (
                                <span className="text-[9px] font-bold px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Running
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {(r.size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                            </span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Context Window</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isStarting}
                    className="flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50 min-w-36 hover:border-zinc-600 transition-colors"
                  >
                    <span>{contextSize.toLocaleString()} tokens</span>
                    <ChevronDown className="h-4 w-4 text-zinc-400 opacity-80 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel>Context Window</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={contextSize.toString()}
                    onValueChange={(val) => setContextSize(parseInt(val))}
                  >
                    {[2048, 4096, 8192, 16384, 32768].map((size) => (
                      <DropdownMenuRadioItem key={size} value={size.toString()} className="font-mono">
                        {size.toLocaleString()} tokens
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">KV Quant</label>
              <div className="flex rounded-lg border border-zinc-700 p-0.5 bg-zinc-950">
                <button
                  disabled={isStarting}
                  onClick={() => setKvType('f16')}
                  className={`px-3 py-1 text-xs rounded font-mono font-medium ${
                    kvType === 'f16' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  F16
                </button>
                <button
                  disabled={isStarting}
                  onClick={() => setKvType('q8_0')}
                  className={`px-3 py-1 text-xs rounded font-mono font-medium ${
                    kvType === 'q8_0' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Q8_0
                </button>
                <button
                  disabled={isStarting}
                  onClick={() => setKvType('q4_0')}
                  className={`px-3 py-1 text-xs rounded font-mono font-medium ${
                    kvType === 'q4_0' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Q4_0
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchModel}
              disabled={busy || isStarting || !selectedModel}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${
                isModelRunning(selectedModel)
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 disabled:opacity-50'
              }`}
            >
              {isStarting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Starting Sidecar...</span>
                </>
              ) : isModelRunning(selectedModel) ? (
                <>
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Select As Primary</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Launch Sidecar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Endpoint Info Bar */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>OpenAI Gateway:</span>
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
            {activeInstances.length > 0
              ? `${activeInstances.length} active model(s) ready for Cursor, Continue, or Aider`
              : 'Gateway returns 503 while idle'}
          </div>
        </div>
      </div>

      {/* Error state alert */}
      {serverState.state === 'error' && (
        <div className="p-4 bg-red-950/80 border border-red-800 rounded-xl space-y-2 text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2 font-bold text-red-300 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate" title={serverState.reason}>
              Inference Server Error: {serverState.reason}
            </span>
          </div>
          {serverState.stderr_tail.length > 0 && (
            <div className="font-mono bg-black/50 p-2.5 rounded border border-red-900/60 overflow-auto max-h-36 space-y-0.5 select-text cursor-text selection:bg-red-500/40 selection:text-white">
              {serverState.stderr_tail.map((line, idx) => (
                <div key={idx} className="select-text whitespace-nowrap">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Logs Terminal with Model Filter */}
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-300">Instance Logs</span>
          </div>
          {activeInstances.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400">Filter:</span>
              <select
                value={selectedLogModel}
                onChange={(e) => setSelectedLogModel(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-0.5 focus:outline-none"
              >
                <option value="all">All Models (Combined)</option>
                {activeInstances.map((inst) => (
                  <option key={inst.model_id} value={inst.model_id}>
                    {inst.model_id} (:{inst.port})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <LogViewer logs={logs} />
        </div>
      </div>
    </div>
  );
}
