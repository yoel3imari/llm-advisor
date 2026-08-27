import { useState, useEffect } from 'react';
import { Sliders, Download, Zap, Star, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { FitResult, HardwareProfile, ServeConfig, ModelRecord } from '../types/domain';
import { recommendModels, startDownload } from '../ipc/commands';
import { MemoryBar } from '../components/common/MemoryBar';
import { VerdictBadge } from '../components/common/VerdictBadge';

interface Props {
  profile: HardwareProfile | null;
  libraryRecords: ModelRecord[];
  onModelDownloaded: () => void;
  onNavigateToServer: (modelId: string) => void;
}

export function RecommendationsView({
  profile,
  libraryRecords,
  onModelDownloaded,
  onNavigateToServer,
}: Props) {
  const [config, setConfig] = useState<ServeConfig>({
    context_size: 4096,
    n_parallel: 1,
    kv_type: 'f16',
    n_gpu_layers: null,
  });

  const [results, setResults] = useState<FitResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const data = await recommendModels(config);
        if (active) setResults(data);
      } catch (err) {
        console.error('Failed to get recommendations', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      active = false;
    };
  }, [config]);

  const handleDownload = async (entryId: string) => {
    try {
      setDownloadingId(entryId);
      await startDownload(entryId);
      onModelDownloaded();
    } catch (err) {
      console.error('Failed to start download', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const hostBudget = profile
    ? Math.min(profile.metal_working_set_bytes, profile.total_ram_bytes)
    : 12 * 1024 * 1024 * 1024;

  const isDownloaded = (id: string) => libraryRecords.some((r) => r.entry_id === id);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Model Recommendations</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Ranked by mathematical RAM/VRAM fit and generation throughput
          </p>
        </div>

        {/* Configuration Controls Bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-200">Context:</span>
            <span className="font-mono text-indigo-300 font-bold w-12">{config.context_size}</span>
            <input
              type="range"
              min="512"
              max="32768"
              step="512"
              value={config.context_size}
              onChange={(e) => setConfig({ ...config, context_size: parseInt(e.target.value) })}
              className="w-28 accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
            <span className="font-semibold text-zinc-200">KV Quant:</span>
            <button
              onClick={() => setConfig({ ...config, kv_type: 'f16' })}
              className={`px-2 py-1 rounded font-mono ${
                config.kv_type === 'f16'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              F16
            </button>
            <button
              onClick={() => setConfig({ ...config, kv_type: 'q8_0' })}
              className={`px-2 py-1 rounded font-mono ${
                config.kv_type === 'q8_0'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Q8_0
            </button>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
            <span className="font-semibold text-zinc-200">Parallel:</span>
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                onClick={() => setConfig({ ...config, n_parallel: n })}
                className={`px-2 py-1 rounded font-mono ${
                  config.n_parallel === n
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && results.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((res) => {
            const entry = res.entry;
            const inLibrary = isDownloaded(entry.id);
            const isDownloading = downloadingId === entry.id;

            return (
              <div
                key={entry.id}
                className={`bg-zinc-900 border rounded-xl p-5 transition-all ${
                  res.fits
                    ? 'border-zinc-800 hover:border-zinc-700 shadow-sm'
                    : 'border-zinc-800/40 opacity-70 bg-zinc-950/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-bold text-base text-white tracking-tight">
                        {entry.id}
                      </h3>
                      <VerdictBadge fits={res.fits} scoreFit={res.score_fit} />
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                        {entry.quant}
                      </span>
                      {entry.gated && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40">
                          Gated Model
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Repo: <span className="font-mono text-zinc-300">{entry.repo_id}</span> ·{' '}
                      {entry.params_billions}B Parameters · {entry.n_layers} Layers (GQA: {entry.n_kv_heads} KV heads)
                    </p>
                  </div>

                  {/* Performance Indicators */}
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-center">
                      <div className="text-zinc-400 text-[11px] flex items-center justify-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" /> Speed
                      </div>
                      <div className="font-bold text-zinc-200 mt-0.5">
                        ~{res.speed_tps_estimate} tok/s
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-zinc-400 text-[11px] flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> GPU Offload
                      </div>
                      <div className="font-bold text-purple-300 mt-0.5">
                        {res.recommended_gpu_layers} / {entry.n_layers} layers
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-zinc-400 text-[11px] flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400" /> Quality
                      </div>
                      <div className="font-bold text-zinc-200 mt-0.5">
                        {entry.quality_tier}/5 Tier
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pl-2">
                      {inLibrary ? (
                        <button
                          onClick={() => onNavigateToServer(entry.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Ready to Serve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(entry.id)}
                          disabled={isDownloading || !res.fits}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                            res.fits
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
                              : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                          }`}
                        >
                          <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                          {isDownloading ? 'Starting...' : 'Download GGUF'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proportional Memory Breakdown */}
                <div className="mt-4 pt-4 border-t border-zinc-800/80">
                  <MemoryBar
                    weightsBytes={res.est_weights_bytes}
                    kvBytes={res.est_kv_bytes}
                    totalBytes={res.est_total_bytes}
                    budgetBytes={hostBudget}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
