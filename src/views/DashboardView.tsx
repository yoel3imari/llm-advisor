import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cpu,
  HardDrive,
  RefreshCw,
  Layers,
  AlertTriangle,
  Search,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import type { FitResult, HardwareProfile, ModelRecord, ServeConfig, DownloadTask } from '../types/domain';
import {
  refreshHardwareProfile,
  recommendModels,
  startDownload,
  deleteLibraryModel,
  syncCatalog,
} from '../ipc/commands';
import { ModelsTable } from '../components/dashboard/ModelsTable';
import { useToast } from '../components/ui/Toast';
import { listen } from '@tauri-apps/api/event';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSearchInput,
  DropdownMenuEmpty,
} from '../components/ui/DropdownMenu';
import { Input } from '../components/ui/Input';
import { Slider } from '../components/ui/Slider';

function isDeepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Props {
  profile: HardwareProfile | null;
  libraryRecords: ModelRecord[];
  activeDownloads?: DownloadTask[];
  onProfileUpdated: (profile: HardwareProfile) => void;
  onModelDownloaded: () => void;
  onNavigateToServer: (modelId: string) => void;
  error?: string | null;
}

export function DashboardView({
  profile,
  libraryRecords,
  activeDownloads = [],
  onProfileUpdated,
  onModelDownloaded,
  onNavigateToServer,
  error,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);

  // Fit configuration state (drives live recommendations)
  const [config, setConfig] = useState<ServeConfig>({
    context_size: 4096,
    n_parallel: 1,
    kv_type: 'f16',
    n_gpu_layers: null,
  });

  const [results, setResults] = useState<FitResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  const { showToast } = useToast();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [familySearch, setFamilySearch] = useState('');

  // Fetch recommendations whenever serve config changes
  useEffect(() => {
    let active = true;
    const fetchRecommendations = async () => {
      setLoadingResults(true);
      try {
        const data = await recommendModels(config);
        if (active) {
          setResults((prev) => (isDeepEqual(prev, data) ? prev : data));
        }
      } catch (err) {
        console.error('Failed to get recommendations', err);
      } finally {
        if (active) setLoadingResults(false);
      }
    };

    fetchRecommendations();
    return () => {
      active = false;
    };
  }, [config]);

  // Listen for background catalog update events on startup or manual sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        unlisten = await listen<{ count: number; etag?: string }>('catalog:updated', async (event) => {
          showToast({
            type: 'info',
            title: 'Catalog Synced',
            description: `Refreshed recommendations with ${event.payload.count} open-source models available.`,
          });
          const data = await recommendModels(config);
          setResults(data);
        });
      } catch (err) {
        console.error('Failed to register catalog:updated listener', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [config, showToast]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const updated = await refreshHardwareProfile();
      onProfileUpdated(updated);
      const data = await recommendModels(config);
      setResults(data);
    } catch (err) {
      console.error('Failed to refresh hardware profile', err);
    } finally {
      setRefreshing(false);
    }
  }, [config, onProfileUpdated]);

  const handleSyncCatalog = useCallback(async () => {
    try {
      setSyncingCatalog(true);
      const res = await syncCatalog();
      if (res.status === 'Updated') {
        showToast({
          type: 'success',
          title: 'Catalog Updated',
          description: `Discovered latest open-source models (${res.details.count} models available).`,
        });
        const data = await recommendModels(config);
        setResults(data);
      } else {
        showToast({
          type: 'info',
          title: 'Catalog Up to Date',
          description: 'No new models found. You have the latest catalog.',
        });
      }
    } catch (err) {
      console.error('Failed to sync catalog', err);
      showToast({
        type: 'error',
        title: 'Catalog Sync Failed',
        description: String(err),
      });
    } finally {
      setSyncingCatalog(false);
    }
  }, [config, showToast]);

  const handleDownload = useCallback(async (entryId: string) => {
    try {
      setDownloadingId(entryId);
      await startDownload(entryId);
      onModelDownloaded();
    } catch (err) {
      console.error('Failed to start download', err);
    } finally {
      setDownloadingId(null);
    }
  }, [onModelDownloaded]);

  const handleDeleteFromLibrary = useCallback(async (entryId: string) => {
    try {
      await deleteLibraryModel(entryId);
      onModelDownloaded();
    } catch (err) {
      console.error('Failed to delete model', err);
    }
  }, [onModelDownloaded]);

  // Available families in current results for dropdown
  const uniqueFamilies = useMemo(
    () => Array.from(new Set(results.map((r) => r.entry.family))).sort(),
    [results]
  );

  const filteredFamilies = useMemo(() => {
    const q = familySearch.trim().toLowerCase();
    if (!q) return uniqueFamilies;
    return uniqueFamilies.filter((fam) => fam.toLowerCase().includes(q));
  }, [uniqueFamilies, familySearch]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Hardware Profiling Error</h2>
        <p className="text-sm text-zinc-400 max-w-md">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
  const hostRamGb = parseFloat(gb(profile.total_ram_bytes));
  const workingSetGb = parseFloat(gb(profile.metal_working_set_bytes));
  const workingSetPct = Math.round((profile.metal_working_set_bytes / profile.total_ram_bytes) * 100);

  const gpuVramGb = profile.gpu_vram_bytes ? parseFloat(gb(profile.gpu_vram_bytes)) : 0;
  const diskFreeGb = parseFloat(gb(profile.disk_free_bytes));
  const hostBudget = Math.min(profile.metal_working_set_bytes, profile.total_ram_bytes);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar relative z-10">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Dashboard & Recommendations</span>
              <span className="inline-flex items-center gap-1.5 text-xs  font-thin font-mono font-semibold px-2.5 py-0.5 rounded-full bg-telemetry-950/80 text-telemetry-300 border border-telemetry-500/40 shadow-glow-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-telemetry-400 animate-pulse"></span>
                {profile.accelerator_backend || 'Live Fit'}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Host silicon telemetry · Mathematical KV fit verification · Ephemeral port binding
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="hardware-button-tactile flex items-center gap-2 px-3.5 py-2 rounded-xl bg-obsidian-900 hover:bg-obsidian-850 text-zinc-200 text-xs font-semibold border border-white/[0.08] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-telemetry-400' : 'text-zinc-400'}`} />
          <span>Refresh Hardware</span>
        </button>
      </div>

      {/* 1. Asymmetric Bento Telemetry Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero Card: Unified Memory / VRAM Radar (Span 2 cols on lg) */}
        <div className="lg:col-span-2 hardware-card p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-telemetry-400">
              <Layers className="w-4 h-4" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-100 font-mono">
                {profile.has_unified_memory ? 'Unified Memory Architecture (UMA)' : 'Host System Memory'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-telemetry-950/80 text-telemetry-300 border border-telemetry-500/30 font-bold">
                {workingSetPct}% Usable Working Set
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="font-mono tabular-nums">
              <span className="text-2xl font-bold text-white tracking-tight">{workingSetGb}</span>
              <span className="text-xs text-zinc-400 ml-1">GB Usable Headroom</span>
            </div>
            <div className="text-xs font-mono text-zinc-400 tabular-nums">
              Total RAM: <span className="text-zinc-200 font-semibold">{hostRamGb} GB</span>
            </div>
          </div>

          {/* Precision Multi-Segment Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-obsidian-950 rounded-full overflow-hidden border border-white/[0.08] p-[1px] shadow-well flex">
              <div
                style={{ width: `${workingSetPct}%` }}
                className="h-full bg-gradient-to-r from-blaze-500 via-blaze-500 to-violet-500 rounded-full transition-all duration-500 shadow-glow-orange"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-400 tabular-nums">
              <span>0 GB</span>
              <span>Safe Inference Ceiling: {workingSetGb} GB</span>
              <span>{hostRamGb} GB Total</span>
            </div>
          </div>

          <div className="pt-1 text-[11px] text-zinc-400 flex items-center justify-between border-t border-white/[0.05]">
            <span>
              {profile.has_unified_memory
                ? 'Zero-copy high-bandwidth unified bus shared with Metal GPU'
                : 'Host system RAM available for CPU inference & partial offload'}
            </span>
            <span className="text-telemetry-400 font-mono text-[10px] uppercase font-semibold">Zero-OOM Cap</span>
          </div>
        </div>

        {/* Card 2: Silicon Engine (1 Col) */}
        <div className="hardware-card p-4 space-y-2.5 flex flex-col justify-between hover:border-violet-500/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-zinc-400">
              <div className="flex items-center gap-2 text-violet-400">
                <Cpu className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200 font-mono">Silicon Engine</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">{profile.arch}</span>
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2 truncate" title={profile.cpu_name}>
              {profile.cpu_name}
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-1">
              {profile.cpu_physical_cores} Physical · {profile.cpu_logical_cores} Threads
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-mono text-[10px]">
              {gpuVramGb > 0 ? `VRAM (${gpuVramGb} GB):` : 'ACCELERATOR:'}
            </span>
            <span className="font-mono text-violet-300 font-semibold truncate max-w-[120px]">
              {profile.gpu_name || profile.accelerator_backend || (profile.has_unified_memory ? 'Metal GPU' : 'CPU')}
            </span>
          </div>
        </div>

        {/* Card 3: High-Speed Storage (1 Col) */}
        <div className="hardware-card p-4 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-phosphor-400">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200 font-mono">NVMe Storage</h3>
              </div>
              <span className="text-[10px] font-mono text-phosphor-400 font-bold">READY</span>
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2 font-mono tabular-nums">
              {diskFreeGb} GB <span className="text-xs font-normal text-zinc-400">Available</span>
            </div>
            <div className="text-xs text-zinc-400 truncate mt-1" title={profile.os_version}>
              {profile.os_version}
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-mono text-[10px]">GGUF WEIGHTS:</span>
            <span className="font-mono text-phosphor-300 font-semibold">{libraryRecords.length} Saved</span>
          </div>
        </div>
      </div>

      {/* 2. Hardware Synthesizer Parameter Console & Filters */}
      <div className="hardware-panel p-4 space-y-4 shadow-bevel">
        {/* Search & Filter Top Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search model, family (Llama, Qwen, DeepSeek), or quant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-obsidian-950/90 border-white/[0.08] focus:border-telemetry-500/60 focus:ring-1 focus:ring-telemetry-500/40 rounded-lg text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Family Filter Dropdown */}
            <DropdownMenu onOpenChange={(open) => { if (!open) setFamilySearch(''); }}>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-obsidian-950 px-2.5 py-1 text-xs text-zinc-200 shadow-bevel hover:border-white/[0.15] transition-colors focus:outline-none focus:ring-1 focus:ring-telemetry-500 min-w-[125px]">
                  <span className="truncate">
                    {familyFilter === 'all'
                      ? 'All Families'
                      : familyFilter.charAt(0).toUpperCase() + familyFilter.slice(1)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[185px] max-h-72 bg-obsidian-900 border-white/[0.09] shadow-2xl">
                <DropdownMenuLabel className="text-zinc-400 font-mono text-[10px] uppercase">Filter Family ({uniqueFamilies.length})</DropdownMenuLabel>
                <DropdownMenuSearchInput
                  value={familySearch}
                  onChange={(e) => setFamilySearch(e.target.value)}
                  placeholder="Search families..."
                />
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuRadioGroup value={familyFilter} onValueChange={setFamilyFilter}>
                  {!familySearch && (
                    <DropdownMenuRadioItem value="all">All Families</DropdownMenuRadioItem>
                  )}
                  {filteredFamilies.map((fam) => (
                    <DropdownMenuRadioItem
                      key={fam}
                      value={fam.toLowerCase()}
                      className="capitalize"
                    >
                      {fam}
                    </DropdownMenuRadioItem>
                  ))}
                  {filteredFamilies.length === 0 && (
                    <DropdownMenuEmpty>No families match &quot;{familySearch}&quot;</DropdownMenuEmpty>
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Verdict Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-obsidian-950 px-2.5 py-1 text-xs text-zinc-200 shadow-bevel hover:border-white/[0.15] transition-colors focus:outline-none focus:ring-1 focus:ring-telemetry-500 min-w-[125px]">
                  <span className="truncate">
                    {verdictFilter === 'all'
                      ? 'All Verdicts'
                      : verdictFilter === 'fits'
                      ? 'Fits Only'
                      : verdictFilter === 'tight'
                      ? 'Tight Fit'
                      : 'No Fit'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[140px] max-h-60 bg-obsidian-900 border-white/[0.09] shadow-2xl">
                <DropdownMenuLabel className="text-zinc-400 font-mono text-[10px] uppercase">Filter Verdict</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuRadioGroup value={verdictFilter} onValueChange={setVerdictFilter}>
                  <DropdownMenuRadioItem value="all">All Verdicts</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="fits">Fits Only</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="tight">Tight Fit</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="nofit">No Fit</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-obsidian-950 px-2.5 py-1 text-xs text-zinc-200 shadow-bevel hover:border-white/[0.15] transition-colors focus:outline-none focus:ring-1 focus:ring-telemetry-500 min-w-[135px]">
                  <span className="truncate">
                    {statusFilter === 'all'
                      ? 'All Statuses'
                      : statusFilter === 'downloaded'
                      ? 'Downloaded (Ready)'
                      : 'Available to Download'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[175px] max-h-60 bg-obsidian-900 border-white/[0.09] shadow-2xl">
                <DropdownMenuLabel className="text-zinc-400 font-mono text-[10px] uppercase">Filter Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="downloaded">
                    Downloaded (Ready)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="available">
                    Available to Download
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sync Catalog Button */}
            <button
              onClick={handleSyncCatalog}
              disabled={syncingCatalog}
              title="Check remote catalog for newly released open-source models"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-obsidian-950 px-3 py-1 text-xs text-zinc-300 shadow-bevel hover:border-white/[0.15] hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-telemetry-500 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  syncingCatalog ? 'animate-spin text-telemetry-400' : 'text-zinc-400'
                }`}
              />
              <span className="hidden sm:inline font-mono">
                {syncingCatalog ? 'Syncing...' : 'Sync Catalog'}
              </span>
              <span className="sm:hidden font-mono">
                {syncingCatalog ? 'Syncing' : 'Sync'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Serving & Context Configuration Console */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1">
          {/* Context Stepper Rack */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-telemetry-400 font-mono text-xs font-semibold">
              <Sliders className="w-3.5 h-3.5" />
              <span>CONTEXT:</span>
            </div>
            <span className="font-mono text-telemetry-300 font-bold tabular-nums w-12 text-sm">{config.context_size}</span>
            <Slider
              min={512}
              max={32768}
              step={512}
              value={[config.context_size]}
              onValueChange={(val) => setConfig({ ...config, context_size: val[0] })}
              className="w-28 cursor-pointer"
            />
            {/* Quick Context Presets */}
            <div className="flex items-center gap-1 bg-obsidian-950 p-1 rounded-lg border border-white/[0.05]">
              {[2048, 4096, 8192, 16384, 32768].map((size) => (
                <button
                  key={size}
                  onClick={() => setConfig({ ...config, context_size: size })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono tabular-nums transition-all ${
                    config.context_size === size
                      ? 'bg-telemetry-500 text-obsidian-950 font-bold shadow-glow-cyan'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                  }`}
                >
                  {size >= 1024 ? `${size / 1024}k` : size}
                </button>
              ))}
            </div>
          </div>

          {/* KV Cache Quant & Parallel Slots Rockers */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 bg-obsidian-950 p-1 rounded-lg border border-white/[0.05]">
              <span className="font-mono text-[10px] text-zinc-400 uppercase px-1">KV:</span>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'f16' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'f16'
                    ? 'bg-telemetry-500 text-obsidian-950 font-bold shadow-glow-cyan'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title="F16: Baseline memory footprint"
              >
                F16
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q8_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'q8_0'
                    ? 'bg-telemetry-500 text-obsidian-950 font-bold shadow-glow-cyan'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title="Q8_0: -50% KV cache VRAM requirement"
              >
                Q8_0
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q4_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'q4_0'
                    ? 'bg-telemetry-500 text-obsidian-950 font-bold shadow-glow-cyan'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title="Q4_0: -75% KV cache VRAM requirement"
              >
                Q4_0
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-obsidian-950 p-1 rounded-lg border border-white/[0.05]">
              <span className="font-mono text-[10px] text-zinc-400 uppercase px-1">Slots:</span>
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, n_parallel: n })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    config.n_parallel === n
                      ? 'bg-telemetry-500 text-obsidian-950 font-bold shadow-glow-cyan'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Models Table */}
      {loadingResults && results.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <ModelsTable
          results={results}
          hostBudget={hostBudget}
          libraryRecords={libraryRecords}
          activeDownloads={activeDownloads}
          downloadingId={downloadingId}
          onDownload={handleDownload}
          onNavigateToServer={onNavigateToServer}
          onDeleteFromLibrary={handleDeleteFromLibrary}
          searchQuery={searchQuery}
          familyFilter={familyFilter}
          verdictFilter={verdictFilter}
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
}
